import {
  analyze,
  type Analysis,
  type Assumptions,
  type PropertyInput,
  type ReferenceData,
  type StateCode,
  type Verdict,
} from '@immo/calc';
import { propertyTypeSchema, stateCodeSchema } from '@immo/data';
import { z } from 'zod';
import type { PipelineStatus, Property } from '@/generated/prisma/client.ts';
import { db } from './db';
import { stateForCity } from './reference';

const money = z.number().min(0).max(1e9);
const optText = (max: number) => z.string().trim().max(max).nullable().optional();

/** Fields a listing (extension or manual entry) provides. */
export const listingSchema = z.object({
  source: z.enum(['is24', 'immowelt', 'manual']),
  externalId: optText(100),
  url: z.url().max(2000).nullable().optional(),
  title: optText(500),
  propertyType: propertyTypeSchema.default('apartment'),
  street: optText(200),
  postalCode: optText(20),
  city: optText(200),
  state: stateCodeSchema.nullable().optional(),
  price: z.number().positive().max(1e9),
  livingArea: z.number().positive().max(100_000),
  rooms: z.number().positive().max(1000).nullable().optional(),
  hausgeldMonthly: money.nullable().optional(),
  actualColdRentMonthly: money.nullable().optional(),
  brokerFeeOverride: z.number().min(0).max(1).nullable().optional(),
  yearBuilt: z.number().int().min(1000).max(2100).nullable().optional(),
});
export type ListingData = z.infer<typeof listingSchema>;

/** Fields editable in the app (PATCH). */
export const propertyPatchSchema = listingSchema
  .omit({ source: true, externalId: true })
  .partial()
  .extend({
    rentOverrideMonthly: money.nullable().optional(),
    renovationCost: money.optional(),
    notes: z.string().max(20_000).optional(),
    excludedReason: optText(500),
  });

const num = (d: { toString(): string } | null) => (d == null ? null : Number(d));

export function toInput(p: Property): PropertyInput {
  return {
    price: Number(p.price),
    livingArea: Number(p.livingArea),
    rooms: num(p.rooms),
    propertyType: p.propertyType,
    city: p.city,
    state: (p.state as StateCode | null) ?? null,
    hausgeldMonthly: num(p.hausgeldMonthly),
    actualColdRentMonthly: num(p.actualColdRentMonthly),
    rentOverrideMonthly: num(p.rentOverrideMonthly),
    brokerFeeOverride: num(p.brokerFeeOverride),
    renovationCost: Number(p.renovationCost),
  };
}

export interface PropertyRow {
  id: string;
  source: Property['source'];
  externalId: string | null;
  url: string | null;
  title: string | null;
  label: string;
  city: string | null;
  price: number;
  grossYield: number | null;
  netYield: number | null;
  cashflow: number | null;
  verdict: Verdict;
  statusId: string;
  statusName: string;
  statusColor: string;
  statusKind: PipelineStatus['kind'];
  lastSeenAt: string;
  placeholderRent: boolean;
}

export function propertyLabel(p: Pick<Property, 'city' | 'rooms' | 'livingArea'>) {
  const de = (x: number) => x.toLocaleString('de-DE', { maximumFractionDigits: 1 });
  return [p.city, p.rooms != null && `${de(Number(p.rooms))} Zi.`, `${de(Number(p.livingArea))} m²`]
    .filter(Boolean)
    .join(' · ');
}

export function toRow(p: Property & { status: PipelineStatus }, a: Analysis): PropertyRow {
  const def = a.scenarios.find((s) => s.equityShare === a.assumptions.defaultEquityShare);
  return {
    id: p.id,
    source: p.source,
    externalId: p.externalId,
    url: p.url,
    title: p.title,
    label: propertyLabel(p),
    city: p.city,
    price: Number(p.price),
    grossYield: a.grossYield,
    netYield: a.netYield,
    cashflow: def?.monthlyCashflow ?? null,
    verdict: a.verdict,
    statusId: p.statusId,
    statusName: p.status.name,
    statusColor: p.status.color,
    statusKind: p.status.kind,
    lastSeenAt: p.lastSeenAt.toISOString(),
    placeholderRent: a.rent.source === 'placeholder_reference',
  };
}

export async function listRows(a: Assumptions, ref: ReferenceData): Promise<PropertyRow[]> {
  // ponytail: loads everything and analyses in memory — fine for one person's few hundred listings.
  const all = await db.property.findMany({
    include: { status: true },
    orderBy: { lastSeenAt: 'desc' },
  });
  return all.map((p) => toRow(p, analyze(toInput(p), a, ref)));
}

/** Fields whose change on revisit is worth a snapshot. */
const SNAPSHOT_FIELDS = [
  'price',
  'livingArea',
  'rooms',
  'hausgeldMonthly',
  'actualColdRentMonthly',
  'brokerFeeOverride',
  'title',
] as const;

function snapshotOf(p: Pick<Property, (typeof SNAPSHOT_FIELDS)[number]>) {
  const fields: Record<string, number | string | null> = {};
  for (const k of SNAPSHOT_FIELDS) fields[k] = norm(p[k]);
  return { price: p.price, fields };
}

/** Decimal vs number vs string-safe comparison. */
const norm = (v: unknown) => (v == null ? null : typeof v === 'string' ? v : Number(v));
const changed = (a: unknown, b: unknown) => norm(a) !== norm(b);

/**
 * Upsert by (source, externalId). Updates lastSeenAt; only overwrites with values the listing
 * actually has (never nulls out data); never touches overrides, notes or status.
 * Creates a snapshot on first save and whenever a key field changed.
 */
export async function upsertListing(data: ListingData) {
  const state = data.state ?? (await stateForCity(data.city ?? null));
  const existing =
    data.source !== 'manual' && data.externalId
      ? await db.property.findUnique({
          where: { source_externalId: { source: data.source, externalId: data.externalId } },
        })
      : null;

  if (!existing) {
    const first = await db.pipelineStatus.findFirst({ orderBy: { sortOrder: 'asc' } });
    if (!first) throw new Error('No pipeline statuses configured');
    const created = await db.property.create({
      data: {
        ...data,
        state,
        statusId: first.id,
        statusEvents: { create: { toStatusId: first.id } },
      },
    });
    await db.propertySnapshot.create({ data: { propertyId: created.id, ...snapshotOf(created) } });
    return { property: created, created: true, snapshot: true };
  }

  const updates = Object.fromEntries(
    Object.entries({ ...data, state }).filter(([, v]) => v !== null && v !== undefined),
  );
  const keyChange = SNAPSHOT_FIELDS.some(
    (k) => k in updates && changed(existing[k], updates[k as keyof typeof updates]),
  );
  const property = await db.property.update({
    where: { id: existing.id },
    data: { ...updates, lastSeenAt: new Date() },
  });
  if (keyChange) {
    await db.propertySnapshot.create({
      data: { propertyId: property.id, ...snapshotOf(property) },
    });
  }
  return { property, created: false, snapshot: keyChange };
}
