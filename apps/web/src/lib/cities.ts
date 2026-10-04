import { normalizeCityKey, type RentRef } from '@immo/calc';

export interface CityInputRow {
  city: string | null;
  price: number;
  livingArea: number;
  grossYield: number | null;
  netYield: number | null;
}

export interface CityComparison {
  cityKey: string;
  city: string;
  count: number;
  medianPricePerM2: number | null;
  avgGrossYield: number | null;
  avgNetYield: number | null;
  /** median €/m² over the city's size bands (latest year, real data preferred) */
  referenceRentPerM2: number | null;
  referenceIsPlaceholder: boolean;
  /** referenceRentPerM2 × 12 ÷ medianPricePerM2 */
  impliedGrossYield: number | null;
}

export const median = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};
const avg = (xs: (number | null)[]) => {
  const v = xs.filter((x): x is number => x != null);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
};

/** Cities that have saved properties or reference rents, side by side. */
export function compareCities(rows: CityInputRow[], refs: RentRef[]): CityComparison[] {
  const byCity = new Map<string, { city: string; rows: CityInputRow[]; refs: RentRef[] }>();
  const entry = (name: string) => {
    const key = normalizeCityKey(name);
    if (!byCity.has(key)) byCity.set(key, { city: name, rows: [], refs: [] });
    return byCity.get(key)!;
  };
  for (const r of rows) if (r.city) entry(r.city).rows.push(r);
  for (const r of refs) entry(r.city).refs.push(r);

  return [...byCity.entries()]
    .map(([cityKey, { city, rows: rs, refs: fs }]) => {
      const real = fs.filter((f) => !f.isPlaceholder);
      const pool = real.length ? real : fs;
      const latest = Math.max(...pool.map((f) => f.year));
      const used = pool.filter((f) => f.year === latest);
      const referenceRentPerM2 = median(used.map((f) => f.eurPerM2));
      const medianPricePerM2 = median(
        rs.filter((r) => r.livingArea > 0).map((r) => r.price / r.livingArea),
      );
      return {
        cityKey,
        city,
        count: rs.length,
        medianPricePerM2,
        avgGrossYield: avg(rs.map((r) => r.grossYield)),
        avgNetYield: avg(rs.map((r) => r.netYield)),
        referenceRentPerM2,
        referenceIsPlaceholder: used.length > 0 && real.length === 0,
        impliedGrossYield:
          referenceRentPerM2 != null && medianPricePerM2
            ? (referenceRentPerM2 * 12) / medianPricePerM2
            : null,
      };
    })
    .sort((a, b) => b.count - a.count || a.city.localeCompare(b.city, 'de'));
}
