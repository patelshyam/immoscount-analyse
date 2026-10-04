import { buildQuery, CATEGORIES, groupResults, type CategoryResult, type OsmElement } from './core';

/*
 * The only outbound calls besides the DB: OpenStreetMap Nominatim + Overpass (DECISIONS #51).
 * Called on demand from the server; results are cached in NearbyLookup.
 */

const UA = 'immo-analyzer (personal, localhost; https://github.com)';
const NOMINATIM = 'https://nominatim.openstreetmap.org/search';
const OVERPASS = 'https://overpass-api.de/api/interpreter';
/** Wider searches for categories with nothing within 2 km (nearest only). */
const FALLBACK_RADII_M = [10_000, 30_000];

export class OsmError extends Error {}

export type Precision = 'exact' | 'street' | 'area';

export interface GeocodeResult {
  lat: number;
  lon: number;
  displayName: string;
  precision: Precision;
}

// Nominatim usage policy: max 1 request/second.
let nextSlot = 0;
async function throttle() {
  const wait = nextSlot - Date.now();
  nextSlot = Math.max(Date.now(), nextSlot) + 1100;
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
}

export async function geocode(address: string): Promise<GeocodeResult | null> {
  await throttle();
  const url = `${NOMINATIM}?${new URLSearchParams({ q: address, format: 'jsonv2', countrycodes: 'de', limit: '1', addressdetails: '1' })}`; // prettier-ignore
  let res: Response;
  try {
    res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(15_000) });
  } catch {
    throw new OsmError('Geocoding service (Nominatim) not reachable.');
  }
  if (!res.ok) throw new OsmError(`Geocoding service answered ${res.status}.`);
  const [hit] = (await res.json()) as {
    lat: string;
    lon: string;
    display_name: string;
    address?: Record<string, string>;
  }[];
  if (!hit) return null;
  const a = hit.address ?? {};
  return {
    lat: Number(hit.lat),
    lon: Number(hit.lon),
    displayName: hit.display_name,
    precision: a.house_number ? 'exact' : a.road ? 'street' : 'area',
  };
}

/** Overpass gives each client 2 slots with a cooldown after each query → back off on overload. */
const RETRY_WAIT_MS = [5_000, 15_000];
// One Overpass query at a time from this server, so our own lookups never compete for slots.
let queue: Promise<unknown> = Promise.resolve();

function overpass(query: string): Promise<OsmElement[]> {
  const run = queue.then(() => overpassNow(query));
  queue = run.catch(() => undefined);
  return run;
}

async function overpassNow(query: string): Promise<OsmElement[]> {
  for (let attempt = 0; attempt <= RETRY_WAIT_MS.length; attempt++) {
    try {
      const res = await fetch(OVERPASS, {
        method: 'POST',
        headers: { 'User-Agent': UA, 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ data: query }),
        signal: AbortSignal.timeout(30_000),
      });
      // Overpass reports overload/timeouts as XML/HTML (sometimes with status 200).
      if (res.ok && res.headers.get('content-type')?.includes('json')) {
        return ((await res.json()) as { elements: OsmElement[] }).elements;
      }
    } catch {
      // network error / timeout → retry
    }
    const wait = RETRY_WAIT_MS[attempt];
    if (wait) await new Promise((r) => setTimeout(r, wait));
  }
  throw new OsmError('Place search (Overpass) is busy or not reachable — try again in a minute.');
}

/** 2 km search for all categories; empty categories are widened (10 km, 30 km) for the nearest. */
export async function findNearby(lat: number, lon: number): Promise<CategoryResult[]> {
  const elements = await overpass(buildQuery(lat, lon, 2000));
  let results = groupResults(elements, { lat, lon });
  for (const radius of FALLBACK_RADII_M) {
    const empty = new Set(results.filter((r) => r.places.length === 0).map((r) => r.id));
    if (!empty.size) break;
    elements.push(
      ...(await overpass(
        buildQuery(
          lat,
          lon,
          radius,
          CATEGORIES.filter((c) => empty.has(c.id)),
        ),
      )),
    );
    results = groupResults(elements, { lat, lon });
  }
  return results;
}
