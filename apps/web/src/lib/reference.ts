import { normalizeCityKey, type Assumptions, type ReferenceData, type StateCode } from '@immo/calc';
import { assumptionsSchema, DEFAULT_ASSUMPTIONS } from '@immo/data';
import { db } from './db';

export async function loadAssumptions(): Promise<Assumptions> {
  const s = await db.settings.findUnique({ where: { id: 1 }, select: { assumptions: true } });
  const parsed = assumptionsSchema.safeParse(s?.assumptions);
  return parsed.success ? parsed.data : DEFAULT_ASSUMPTIONS;
}

export async function loadReference(): Promise<ReferenceData> {
  const [tax, rents] = await Promise.all([
    db.transferTaxRate.findMany(),
    db.rentReference.findMany(),
  ]);
  return {
    transferTax: tax.map((r) => ({
      state: r.state as StateCode,
      rate: Number(r.rate),
      validFrom: r.validFrom?.toISOString().slice(0, 10) ?? null,
    })),
    rentRefs: rents.map((r) => ({
      city: r.city,
      sizeMin: Number(r.sizeMin),
      sizeMax: r.sizeMax == null ? null : Number(r.sizeMax),
      eurPerM2: Number(r.eurPerM2),
      source: r.source,
      year: r.year,
      isPlaceholder: r.isPlaceholder,
    })),
  };
}

export async function stateForCity(city: string | null): Promise<StateCode | null> {
  if (!city) return null;
  const row = await db.cityState.findUnique({ where: { cityKey: normalizeCityKey(city) } });
  return (row?.state as StateCode | undefined) ?? null;
}
