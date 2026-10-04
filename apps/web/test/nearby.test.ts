import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildQuery,
  CATEGORIES,
  groupResults,
  haversineM,
  type OsmElement,
} from '@/lib/nearby/core';

// Recorded once from Overpass for Frankfurter Straße 120, 63263 Neu-Isenburg (2 km).
const ORIGIN = { lat: 50.0514798, lon: 8.6954791 };
const FIXTURE = JSON.parse(
  readFileSync(new URL('./fixtures/overpass-neu-isenburg-2km.json', import.meta.url), 'utf8'),
) as { elements: OsmElement[] };

const byId = (rs: ReturnType<typeof groupResults>, id: string) => rs.find((r) => r.id === id)!;

describe('haversineM', () => {
  it('1° of latitude / of longitude at the equator ≈ 111.195 km', () => {
    expect(haversineM(0, 0, 1, 0)).toBeCloseTo(111_195, -1);
    expect(haversineM(0, 0, 0, 1)).toBeCloseTo(111_195, -1);
    expect(haversineM(50, 8, 50, 8)).toBe(0);
  });
  it('Frankfurt Hbf → München Hbf ≈ 304 km', () => {
    expect(haversineM(50.1071, 8.6638, 48.1402, 11.56) / 1000).toBeCloseTo(304, 0);
  });
});

describe('buildQuery', () => {
  it('covers all 10 categories with the radius and point', () => {
    const q = buildQuery(50.05148, 8.695479, 2000);
    expect(CATEGORIES.map((c) => c.label)).toEqual([
      'Schulen', 'Kindergarten', 'Supermarkt', 'ÖPNV', 'Ärzte',
      'Krankenhäuser', 'Apotheken', 'Restaurants', 'Parks', 'Banken',
    ]); // prettier-ignore
    for (const s of [
      '["amenity"="school"]',
      '["amenity"="kindergarten"]',
      '["shop"="supermarket"]',
      '["highway"="bus_stop"]',
      '["railway"~"^(station|halt|tram_stop)$"]',
      '["amenity"~"^(doctors|dentist)$"]',
      '["amenity"="hospital"]',
      '["amenity"="pharmacy"]',
      '["amenity"="restaurant"]',
      '["leisure"="park"]',
      '["amenity"="bank"]',
    ]) {
      expect(q).toContain(`nwr${s}(around:2000,50.051480,8.695479);`);
    }
    expect(q).toContain('out center tags;');
  });
  it('can be limited to some categories (wider fallback searches)', () => {
    const q = buildQuery(
      50,
      8,
      10_000,
      CATEGORIES.filter((c) => c.id === 'hospitals'),
    );
    expect(q.match(/nwr/g)).toHaveLength(1);
    expect(q).toContain('(around:10000,');
  });
});

describe('groupResults on the recorded Neu-Isenburg response', () => {
  const rs = groupResults(FIXTURE.elements, ORIGIN);

  it('every category except hospitals has places within 2 km, sorted by distance', () => {
    for (const r of rs) {
      if (r.id === 'hospitals') continue;
      expect(r.withinRadius, r.label).toBe(true);
      expect(r.places.length, r.label).toBeGreaterThan(0);
      expect(r.places.every((p) => p.distanceM <= 2000)).toBe(true);
      const d = r.places.map((p) => p.distanceM);
      expect([...d].sort((a, b) => a - b)).toEqual(d);
    }
    expect(byId(rs, 'hospitals')).toMatchObject({ withinRadius: false, places: [] });
  });

  it('known places with plausible distances', () => {
    expect(byId(rs, 'supermarkets').places[0]).toMatchObject({ name: 'Kadir Market' });
    expect(byId(rs, 'supermarkets').places[0]!.distanceM).toBeCloseTo(94, -1);
    expect(byId(rs, 'pharmacies').places[0]!.name).toBe('Kronen Apotheke');
    expect(byId(rs, 'transit').places[0]).toMatchObject({ name: 'Friedrichstraße', kind: 'Bus' });
    expect(byId(rs, 'schools').places.map((p) => p.name)).toContain('Albert-Schweitzer-Schule');
  });

  it('ÖPNV: one entry per stop name (platforms/directions collapsed)', () => {
    const t = byId(rs, 'transit').places;
    for (const [i, a] of t.entries()) {
      for (const b of t.slice(i + 1)) {
        if (a.name === b.name)
          expect(haversineM(a.lat, a.lon, b.lat, b.lon)).toBeGreaterThanOrEqual(600);
      }
    }
    const raw = FIXTURE.elements.filter(
      (e) => e.tags?.highway === 'bus_stop' && e.tags.name === 'Friedrichstraße',
    );
    expect(raw.length).toBeGreaterThan(1); // the fixture really has duplicate platforms
  });

  it('every place has an OSM link', () => {
    for (const p of rs.flatMap((r) => r.places)) {
      expect(p.osmUrl).toMatch(/^https:\/\/www\.openstreetmap\.org\/(node|way|relation)\/\d+$/);
    }
  });
});

describe('groupResults rules', () => {
  const at = (km: number) => ({ lat: ORIGIN.lat + km / 111.195, lon: ORIGIN.lon }); // north by km
  const el = (id: number, km: number, tags: Record<string, string>, type: OsmElement['type'] = 'node'): OsmElement => ({ type, id, ...at(km), tags }); // prettier-ignore

  it('nothing within 2 km → only the nearest one, flagged', () => {
    const r = byId(
      groupResults(
        [
          el(1, 8, { amenity: 'hospital', name: 'Far' }),
          el(2, 4.5, { amenity: 'hospital', name: 'Nearer' }),
        ],
        ORIGIN,
      ),
      'hospitals',
    );
    expect(r.withinRadius).toBe(false);
    expect(r.places).toHaveLength(1);
    expect(r.places[0]!.name).toBe('Nearer');
    expect(r.places[0]!.distanceM).toBeCloseTo(4500, -1);
  });

  it('something within 2 km → all within, nothing beyond', () => {
    const r = byId(
      groupResults(
        [el(1, 0.5, { amenity: 'bank', name: 'A' }), el(2, 1.9, { amenity: 'bank', name: 'B' }), el(3, 3, { amenity: 'bank', name: 'C' })], // prettier-ignore
        ORIGIN,
      ),
      'banks',
    );
    expect(r.places.map((p) => p.name)).toEqual(['A', 'B']);
  });

  it('unnamed places get a label and are not collapsed; centers of ways are used', () => {
    const park = (id: number, km: number): OsmElement => ({ type: 'way', id, center: at(km), tags: { leisure: 'park' } }); // prettier-ignore
    const r = byId(groupResults([park(1, 0.3), park(2, 0.35)], ORIGIN), 'parks');
    expect(r.places.map((p) => p.name)).toEqual(['Park', 'Park']);
    expect(r.places[0]!.osmUrl).toBe('https://www.openstreetmap.org/way/1');
  });

  it('one element matching two filters is listed once; dentists are labelled', () => {
    const r = byId(
      groupResults(
        [el(1, 0.2, { amenity: 'dentist', healthcare: 'dentist', name: 'Dr. Zahn' })],
        ORIGIN,
      ),
      'doctors',
    );
    expect(r.places).toHaveLength(1);
    expect(r.places[0]!.kind).toBe('Zahnarzt');
  });
});

// ---- API route (OSM calls mocked; no network in tests) ----

const geocode = vi.fn();
const findNearby = vi.fn();
vi.mock('@/lib/nearby/osm', async () => {
  class OsmError extends Error {}
  return {
    OsmError,
    geocode: (a: string) => geocode(a),
    findNearby: (...x: number[]) => findNearby(...x),
  };
});
const rows = new Map<string, Record<string, unknown>>();
const links = new Map<string, string>(); // propertyId → nearbyLookupId
type Range = { gte: number; lte: number };
vi.mock('@/lib/db', () => ({
  db: {
    settings: { findUnique: vi.fn(async () => ({ apiToken: 'tok' })) },
    nearbyLookup: {
      findUnique: vi.fn(async ({ where }: { where: { queryKey: string } }) => rows.get(where.queryKey) ?? null), // prettier-ignore
      findFirst: vi.fn(
        async ({ where }: { where: { lat: Range; lon: Range } }) =>
          [...rows.values()].find(
            (r) =>
              (r.lat as number) >= where.lat.gte &&
              (r.lat as number) <= where.lat.lte &&
              (r.lon as number) >= where.lon.gte &&
              (r.lon as number) <= where.lon.lte,
          ) ?? null,
      ),
      upsert: vi.fn(
        async ({
          where,
          create,
          update,
        }: {
          where: { queryKey: string };
          create: Record<string, unknown>;
          update: Record<string, unknown>;
        }) => {
          // prettier-ignore
          const prev = rows.get(where.queryKey);
          const row = prev ? { ...prev, ...update } : { id: `n${rows.size + 1}`, ...create };
          rows.set(where.queryKey, row);
          return row;
        },
      ),
    },
    property: {
      updateMany: vi.fn(
        async ({ where, data }: { where: { id: string }; data: { nearbyLookupId: string } }) => {
          // prettier-ignore
          links.set(where.id, data.nearbyLookupId);
          return { count: 1 };
        },
      ),
    },
  },
}));

const route = await import('@/app/api/nearby/route');
const { OsmError } = await import('@/lib/nearby/osm');
const post = (
  body: unknown,
  headers: Record<string, string> = { 'sec-fetch-site': 'same-origin' },
) =>
  route.POST(
    new Request('http://127.0.0.1/api/nearby', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(body),
    }),
    {} as never,
  );

describe('POST /api/nearby', () => {
  const ADDRESS = 'Frankfurter Straße 120, 63263 Neu-Isenburg';
  beforeEach(() => {
    rows.clear();
    links.clear();
    geocode.mockReset().mockResolvedValue({ ...ORIGIN, displayName: 'X', precision: 'exact' });
    findNearby.mockReset().mockResolvedValue(groupResults(FIXTURE.elements, ORIGIN));
  });

  it('401 without auth, 400 for a too-short address', async () => {
    expect((await post({ address: ADDRESS }, {})).status).toBe(401);
    expect((await post({ address: 'x' })).status).toBe(400);
  });

  it('looks up once, then serves from cache; refresh refetches', async () => {
    const first = await post({ address: ADDRESS });
    expect(first.status).toBe(200);
    const { result } = await first.json();
    expect(result.categories).toHaveLength(10);
    expect(result.precision).toBe('exact');
    // same address, different spelling → same cache entry
    expect((await post({ address: 'frankfurter strasse 120 63263 neu isenburg' })).status).toBe(
      200,
    );
    expect(geocode).toHaveBeenCalledTimes(1);
    expect(findNearby).toHaveBeenCalledTimes(1);
    await post({ address: ADDRESS, refresh: true });
    expect(findNearby).toHaveBeenCalledTimes(2);
  });

  it('different spelling, same spot → geocode only, saved places reused (no new search)', async () => {
    await post({ address: ADDRESS });
    const res = await post({ address: 'Frankfurter Str. 120, Neu-Isenburg' }); // other cache key
    const { result } = await res.json();
    expect(geocode).toHaveBeenCalledTimes(2);
    expect(findNearby).toHaveBeenCalledTimes(1);
    expect(result.fromCache).toBe(true);
    expect(result.categories).toHaveLength(10);
    // …and that spelling is now saved too: no geocode next time
    await post({ address: 'Frankfurter Str. 120, Neu-Isenburg' });
    expect(geocode).toHaveBeenCalledTimes(2);
  });

  it('a search from a property page is linked to the property', async () => {
    const res = await post({ address: 'Garten straße 16 Schöneck', propertyId: 'p1' });
    const { result } = await res.json();
    expect(links.get('p1')).toBe(result.id);
    expect(result.fromCache).toBe(false);
    // cached search with another property id links that one too, without a new search
    await post({ address: 'Garten straße 16 Schöneck', propertyId: 'p2' });
    expect(links.get('p2')).toBe(result.id);
    expect(findNearby).toHaveBeenCalledTimes(1);
  });

  it('refresh never reuses a saved result', async () => {
    await post({ address: ADDRESS });
    const { result } = await (await post({ address: ADDRESS, refresh: true })).json();
    expect(findNearby).toHaveBeenCalledTimes(2);
    expect(result.fromCache).toBe(false);
  });

  it('404 when the address is not found; 502 when OSM is unavailable', async () => {
    geocode.mockResolvedValueOnce(null);
    expect((await post({ address: 'Nirgendwostraße 1, 99999 Nirgendwo' })).status).toBe(404);
    findNearby.mockRejectedValueOnce(new OsmError('busy'));
    const res = await post({ address: ADDRESS });
    expect(res.status).toBe(502);
    expect((await res.json()).error).toBe('busy');
  });
});
