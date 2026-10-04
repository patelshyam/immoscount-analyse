/*
 * Pure "nearby amenities" logic (no I/O): OSM tag filters per category, the Overpass query,
 * straight-line distances, and the "all within 2 km, else the nearest one" rule.
 */

interface TagFilter {
  key: string;
  values: string[];
}

export interface Category {
  id: string;
  label: string;
  /** label for unnamed places */
  fallback: string;
  filters: TagFilter[];
  /** same-name places closer than this collapse into one (platforms, node+building duplicates) */
  dedupeM: number;
}

const f = (key: string, ...values: string[]): TagFilter => ({ key, values });

export const CATEGORIES: Category[] = [
  {
    id: 'schools',
    label: 'Schulen',
    fallback: 'Schule',
    filters: [f('amenity', 'school')],
    dedupeM: 300,
  },
  { id: 'kindergartens', label: 'Kindergarten', fallback: 'Kindergarten', filters: [f('amenity', 'kindergarten')], dedupeM: 300 }, // prettier-ignore
  { id: 'supermarkets', label: 'Supermarkt', fallback: 'Supermarkt', filters: [f('shop', 'supermarket')], dedupeM: 300 }, // prettier-ignore
  {
    id: 'transit',
    label: 'ÖPNV',
    fallback: 'Haltestelle',
    filters: [
      f('highway', 'bus_stop'),
      f('railway', 'station', 'halt', 'tram_stop'),
      f('public_transport', 'station'),
    ],
    dedupeM: 600,
  },
  {
    id: 'doctors',
    label: 'Ärzte',
    fallback: 'Arztpraxis',
    filters: [f('amenity', 'doctors', 'dentist'), f('healthcare', 'doctor', 'dentist')],
    dedupeM: 50,
  },
  { id: 'hospitals', label: 'Krankenhäuser', fallback: 'Krankenhaus', filters: [f('amenity', 'hospital')], dedupeM: 500 }, // prettier-ignore
  { id: 'pharmacies', label: 'Apotheken', fallback: 'Apotheke', filters: [f('amenity', 'pharmacy')], dedupeM: 100 }, // prettier-ignore
  { id: 'restaurants', label: 'Restaurants', fallback: 'Restaurant', filters: [f('amenity', 'restaurant')], dedupeM: 100 }, // prettier-ignore
  { id: 'parks', label: 'Parks', fallback: 'Park', filters: [f('leisure', 'park')], dedupeM: 500 },
  { id: 'banks', label: 'Banken', fallback: 'Bank', filters: [f('amenity', 'bank')], dedupeM: 100 },
];

export const RADIUS_M = 2000;

const ql = ({ key, values }: TagFilter) =>
  values.length === 1 ? `["${key}"="${values[0]}"]` : `["${key}"~"^(${values.join('|')})$"]`;

/** One Overpass QL query covering the given categories around a point. */
export function buildQuery(
  lat: number,
  lon: number,
  radiusM: number,
  categories = CATEGORIES,
): string {
  const around = `(around:${Math.round(radiusM)},${lat.toFixed(6)},${lon.toFixed(6)})`;
  const lines = categories.flatMap((c) => c.filters.map((flt) => `  nwr${ql(flt)}${around};`));
  return `[out:json][timeout:25];\n(\n${lines.join('\n')}\n);\nout center tags;`;
}

/** Great-circle distance in metres (straight line, "Luftlinie"). */
export function haversineM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * 6_371_008.8 * Math.asin(Math.min(1, Math.sqrt(a)));
}

export interface OsmElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

export interface Place {
  name: string;
  /** e.g. "Zahnarzt", "Bahnhof" — null when nothing to add */
  kind: string | null;
  distanceM: number;
  lat: number;
  lon: number;
  osmUrl: string;
}

export interface CategoryResult {
  id: string;
  label: string;
  /** false → nothing within the radius; `places` holds only the nearest one (if any) */
  withinRadius: boolean;
  places: Place[];
}

const matches = (c: Category, tags: Record<string, string>) =>
  c.filters.some((flt) => flt.values.includes(tags[flt.key] ?? ''));

function kindOf(c: Category, t: Record<string, string>): string | null {
  if (c.id === 'doctors')
    return t.amenity === 'dentist' || t.healthcare === 'dentist' ? 'Zahnarzt' : null;
  if (c.id === 'transit') {
    if (t.railway === 'station' || t.railway === 'halt' || t.public_transport === 'station')
      return 'Bahn';
    if (t.railway === 'tram_stop') return 'Straßenbahn';
    if (t.highway === 'bus_stop') return 'Bus';
  }
  return null;
}

/**
 * Per category: every place within `radiusM`, sorted by distance; if there is none, only the
 * single nearest place found (from wider searches). Same-name duplicates nearby collapse.
 */
export function groupResults(
  elements: OsmElement[],
  origin: { lat: number; lon: number },
  radiusM = RADIUS_M,
): CategoryResult[] {
  return CATEGORIES.map((c) => {
    const all: Place[] = [];
    for (const el of elements) {
      const tags = el.tags ?? {};
      const lat = el.lat ?? el.center?.lat;
      const lon = el.lon ?? el.center?.lon;
      if (lat == null || lon == null || !matches(c, tags)) continue;
      all.push({
        name: tags.name?.trim() || c.fallback,
        kind: kindOf(c, tags),
        distanceM: haversineM(origin.lat, origin.lon, lat, lon),
        lat,
        lon,
        osmUrl: `https://www.openstreetmap.org/${el.type}/${el.id}`,
      });
    }
    all.sort((a, b) => a.distanceM - b.distanceM);

    const kept: Place[] = [];
    const seen = new Set<string>();
    for (const p of all) {
      const key = `${p.osmUrl}`;
      if (seen.has(key)) continue; // same element matched by two filters
      seen.add(key);
      const named = p.name !== c.fallback;
      if (named && kept.some((k) => k.name === p.name && haversineM(k.lat, k.lon, p.lat, p.lon) < c.dedupeM)) continue; // prettier-ignore
      kept.push(p);
    }

    const within = kept.filter((p) => p.distanceM <= radiusM);
    return {
      id: c.id,
      label: c.label,
      withinRadius: within.length > 0,
      places: within.length ? within : kept.slice(0, 1),
    };
  });
}
