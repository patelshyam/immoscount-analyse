import { normalizeCityKey } from '@immo/calc';
import type { NearbyLookup } from '@/generated/prisma/client.ts';
import { db } from '../db';
import type { CategoryResult } from './core';
import { findNearby, geocode, type Precision } from './osm';

export interface NearbyResult {
  id: string;
  address: string;
  displayName: string;
  lat: number;
  lon: number;
  precision: Precision;
  fetchedAt: string;
  /** true when served from the database without a new place search */
  fromCache: boolean;
  categories: CategoryResult[];
}

export const queryKeyOf = (address: string) => normalizeCityKey(address);

/** ~1 m: a differently spelled address that geocodes to the same spot reuses the saved result. */
const SAME_SPOT_DEG = 0.00001;

export const toNearbyResult = (r: NearbyLookup, fromCache = true): NearbyResult => ({
  id: r.id,
  address: r.address,
  displayName: r.displayName,
  lat: r.lat,
  lon: r.lon,
  precision: r.precision as Precision,
  fetchedAt: r.fetchedAt.toISOString(),
  fromCache,
  categories: r.results as unknown as CategoryResult[],
});

export async function cachedNearby(address: string): Promise<NearbyResult | null> {
  const key = queryKeyOf(address);
  if (!key) return null;
  const row = await db.nearbyLookup.findUnique({ where: { queryKey: key } });
  return row ? toNearbyResult(row) : null;
}

/**
 * Saved result first: same address text → no network at all; same coordinates → only the
 * (cheap) geocode, no place search. `refresh` always searches again. With `propertyId` the
 * result is linked to that property, so its page shows it next time whatever was typed.
 * Returns null when the address can't be found; throws OsmError on outages.
 */
export async function lookupNearby(
  address: string,
  { refresh = false, propertyId }: { refresh?: boolean; propertyId?: string } = {},
): Promise<NearbyResult | null> {
  const queryKey = queryKeyOf(address);
  let row = refresh ? null : await db.nearbyLookup.findUnique({ where: { queryKey } });
  let fromCache = row != null;

  if (!row) {
    const geo = await geocode(address);
    if (!geo) return null;
    const sameSpot = refresh
      ? null
      : await db.nearbyLookup.findFirst({
          where: {
            lat: { gte: geo.lat - SAME_SPOT_DEG, lte: geo.lat + SAME_SPOT_DEG },
            lon: { gte: geo.lon - SAME_SPOT_DEG, lte: geo.lon + SAME_SPOT_DEG },
          },
          orderBy: { fetchedAt: 'desc' },
        });
    fromCache = sameSpot != null;
    const data = {
      address,
      lat: geo.lat,
      lon: geo.lon,
      displayName: geo.displayName,
      precision: geo.precision,
      results: (sameSpot?.results ?? (await findNearby(geo.lat, geo.lon))) as object,
      fetchedAt: sameSpot?.fetchedAt ?? new Date(),
    };
    row = await db.nearbyLookup.upsert({
      where: { queryKey },
      update: data,
      create: { queryKey, ...data },
    });
  }

  if (propertyId) {
    await db.property.updateMany({ where: { id: propertyId }, data: { nearbyLookupId: row.id } });
  }
  return toNearbyResult(row, fromCache);
}
