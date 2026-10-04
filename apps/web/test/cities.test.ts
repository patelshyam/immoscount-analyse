import type { RentRef } from '@immo/calc';
import { describe, expect, it } from 'vitest';
import { compareCities, median } from '@/lib/cities';

const ref = (over: Partial<RentRef>): RentRef => ({
  city: 'Leipzig',
  sizeMin: 0,
  sizeMax: 40,
  eurPerM2: 10,
  source: 's',
  year: 2026,
  isPlaceholder: false,
  ...over,
});

describe('median', () => {
  it('odd, even, empty', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(median([])).toBeNull();
  });
});

describe('compareCities', () => {
  const rows = [
    { city: 'Leipzig', price: 200_000, livingArea: 100, grossYield: 0.05, netYield: 0.03 }, // 2.000 €/m²
    { city: 'leipzig', price: 300_000, livingArea: 100, grossYield: 0.04, netYield: null }, // 3.000 €/m²
    { city: 'Düsseldorf', price: 400_000, livingArea: 80, grossYield: null, netYield: null },
    { city: null, price: 1, livingArea: 1, grossYield: null, netYield: null },
  ];

  it('groups by normalized city and computes medians, averages, implied yield', () => {
    const out = compareCities(rows, [
      ref({ eurPerM2: 9 }),
      ref({ sizeMin: 40, sizeMax: 60, eurPerM2: 11 }),
      ref({ eurPerM2: 99, year: 2020 }), // older year ignored
      ref({ eurPerM2: 50, isPlaceholder: true }), // placeholder ignored when real data exists
    ]);
    const leipzig = out.find((c) => c.cityKey === 'leipzig')!;
    expect(leipzig).toMatchObject({
      count: 2,
      medianPricePerM2: 2500,
      avgNetYield: 0.03,
      referenceRentPerM2: 10,
      referenceIsPlaceholder: false,
    });
    expect(leipzig.avgGrossYield).toBeCloseTo(0.045, 12);
    expect(leipzig.impliedGrossYield).toBeCloseTo((10 * 12) / 2500, 12);
    expect(out[0]!.cityKey).toBe('leipzig'); // most properties first
  });

  it('city with only placeholder refs is flagged; city with only refs has no prices', () => {
    const out = compareCities([], [ref({ city: 'Berlin', isPlaceholder: true })]);
    expect(out).toEqual([
      expect.objectContaining({ city: 'Berlin', count: 0, referenceIsPlaceholder: true, medianPricePerM2: null, impliedGrossYield: null }), // prettier-ignore
    ]);
  });

  it('city without refs', () => {
    const d = compareCities(rows, []).find((c) => c.cityKey === 'duesseldorf')!;
    expect(d).toMatchObject({ referenceRentPerM2: null, referenceIsPlaceholder: false, impliedGrossYield: null }); // prettier-ignore
  });
});
