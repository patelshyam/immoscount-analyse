import { readFileSync } from 'node:fs';
import { normalizeCityKey } from '@immo/calc';
import { describe, expect, it } from 'vitest';
import {
  assumptionsSchema,
  buildCityStateMap,
  CITY_STATE,
  DEFAULT_ASSUMPTIONS,
  DEMO_RENT_REFERENCES,
  rentReferenceSchema,
  SIZE_BANDS,
  STATE_CODES,
  TRANSFER_TAX,
} from '../src/index';

describe('transfer tax', () => {
  it('covers all 16 states exactly once with 0 < rate < 0.1', () => {
    expect(TRANSFER_TAX.map((r) => r.state).sort()).toEqual([...STATE_CODES].sort());
    for (const r of TRANSFER_TAX) expect(r.rate > 0 && r.rate < 0.1).toBe(true);
  });
});

describe('defaults', () => {
  it('default assumptions satisfy the schema', () => {
    expect(assumptionsSchema.parse(DEFAULT_ASSUMPTIONS)).toEqual(DEFAULT_ASSUMPTIONS);
  });
});

describe('city → state', () => {
  const map = new Map(CITY_STATE.map((r) => [r.cityKey, r.state]));

  it('has no duplicate keys and only valid states', () => {
    expect(map.size).toBe(CITY_STATE.length);
    for (const r of CITY_STATE) {
      expect(STATE_CODES).toContain(r.state);
      expect(r.cityKey).toBe(r.cityKey.trim());
    }
  });

  it('covers the ≥20k list (704 cities, minus ambiguous names)', () => {
    expect(CITY_STATE.length).toBeGreaterThan(700);
  });

  it('known cities and aliases', () => {
    expect(map.get('muenchen')).toBe('BY');
    expect(map.get('frankfurt am main')).toBe('HE');
    expect(map.get('frankfurt oder')).toBe('BB');
    expect(map.get('halle saale')).toBe('ST');
    expect(map.get('duesseldorf')).toBe('NW');
    expect(map.get('muelheim')).toBe('NW');
    expect(map.get('freiburg')).toBe('BW');
    expect(map.get(normalizeCityKey('Brandenburg an der Havel'))).toBe('BB');
  });

  it('drops keys that are ambiguous across states', () => {
    expect(map.has('senden')).toBe(false); // BY + NW
    expect(map.has('frankfurt')).toBe(false); // HE + BB
    expect(map.has('halle')).toBe(false); // ST + NW
  });

  it('builder keeps same-state duplicates', () => {
    const rows = buildCityStateMap([
      { name: 'Foo', state: 'BY' },
      { name: 'Foo', state: 'BY' },
      { name: 'Bar am See', state: 'NW' },
    ]);
    expect(rows.map((r) => r.cityKey).sort()).toEqual(['bar', 'bar am see', 'foo']);
  });
});

describe('rent reference', () => {
  it('demo rows are valid, all placeholders, cover every size band', () => {
    for (const r of DEMO_RENT_REFERENCES) {
      expect(rentReferenceSchema.parse(r).isPlaceholder).toBe(true);
    }
    expect(DEMO_RENT_REFERENCES.filter((r) => r.city === 'Leipzig')).toHaveLength(
      SIZE_BANDS.length,
    );
  });

  it('CSV template has the documented header', () => {
    const csv = readFileSync(
      new URL('../src/rent-reference.template.csv', import.meta.url),
      'utf8',
    );
    expect(csv.trim()).toBe('city,state,size_min,size_max,eur_per_m2,source,year,notes');
  });
});
