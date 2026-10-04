import { normalizeCityKey } from '@immo/calc';
import type { NearbyLookup } from '@/generated/prisma/client.ts';
import { db } from '../db';
import type { CategoryResult } from './core';
import { findNearby, geocode, type Precision } from './osm';

export interface NearbyResult {
  address: string;
  displayName: string;
  lat: number;
  lon: number;
  precision: Precision;
  fetchedAt: string;
  categories: CategoryResult[];
}

export const queryKeyOf = (address: string) => normalizeCityKey(address);

const dto = (r: NearbyLookup): NearbyResult => ({
  address: r.address,
  displayName: r.displayName,
  lat: r.lat,
  lon: r.lon,
  precision: r.precision as Precision,
  fetchedAt: r.fetchedAt.toISOString(),
  categories: r.results as unknown as CategoryResult[],
});

export async function cachedNearby(address: string): Promise<NearbyResult | null> {
  const key = queryKeyOf(address);
  if (!key) return null;
  const row = await db.nearbyLookup.findUnique({ where: { queryKey: key } });
  return row ? dto(row) : null;
}

/** Cached unless `refresh`; null when the address can't be found. Throws OsmError on outages. */
export async function lookupNearby(address: string, refresh = false): Promise<NearbyResult | null> {
  if (!refresh) {
    const hit = await cachedNearby(address);
    if (hit) return hit;
  }
  const geo = await geocode(address);
  if (!geo) return null;
  const categories = await findNearby(geo.lat, geo.lon);
  const data = {
    address,
    lat: geo.lat,
    lon: geo.lon,
    displayName: geo.displayName,
    precision: geo.precision,
    results: categories as unknown as object,
    fetchedAt: new Date(),
  };
  const queryKey = queryKeyOf(address);
  const row = await db.nearbyLookup.upsert({
    where: { queryKey },
    update: data,
    create: { queryKey, ...data },
  });
  return dto(row);
}
