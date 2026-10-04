import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseCsv, parseRentCsv, rentRowsToCsv, toCsv } from '../src/index';

describe('parseCsv / toCsv', () => {
  it('handles quotes, escaped quotes, commas and newlines in fields, CRLF, BOM', () => {
    const text = '﻿a,b,c\r\n"x, y","say ""hi""","line1\nline2"\r\n\r\n1,,3';
    expect(parseCsv(text)).toEqual([
      ['a', 'b', 'c'],
      ['x, y', 'say "hi"', 'line1\nline2'],
      ['1', '', '3'],
    ]);
  });

  it('round-trips arbitrary cells', () => {
    const rows = [
      ['a', 'b, c', 'd"e', 'f\ng'],
      ['', '1', '2,5', ''],
    ];
    expect(parseCsv(toCsv(rows))).toEqual(rows);
  });
});

describe('rent reference CSV', () => {
  const CSV = [
    'city,state,size_min,size_max,eur_per_m2,source,year,notes',
    'Leipzig,SN,60,80,8.9,Mietspiegel Leipzig,2026,',
    'Düsseldorf,nw,0,40,"14,5","Mietspiegel, Tabelle 1",2025,"note with ""quotes"""',
    'Leipzig,SN,100,,7.2,Mietspiegel Leipzig,2026,open band',
  ].join('\n');

  it('parses valid rows (dot or German decimals, empty size_max = open band)', () => {
    const { rows, errors } = parseRentCsv(CSV);
    expect(errors).toEqual([]);
    expect(rows).toEqual([
      { city: 'Leipzig', state: 'SN', sizeMin: 60, sizeMax: 80, eurPerM2: 8.9, source: 'Mietspiegel Leipzig', year: 2026, isPlaceholder: false, notes: null }, // prettier-ignore
      { city: 'Düsseldorf', state: 'NW', sizeMin: 0, sizeMax: 40, eurPerM2: 14.5, source: 'Mietspiegel, Tabelle 1', year: 2025, isPlaceholder: false, notes: 'note with "quotes"' }, // prettier-ignore
      { city: 'Leipzig', state: 'SN', sizeMin: 100, sizeMax: null, eurPerM2: 7.2, source: 'Mietspiegel Leipzig', year: 2026, isPlaceholder: false, notes: 'open band' }, // prettier-ignore
    ]);
  });

  it('export → import round trip keeps every field including the placeholder flag', () => {
    const { rows } = parseRentCsv(CSV);
    const withPlaceholder = [
      ...rows,
      { ...rows[0]!, city: 'Berlin', state: null, isPlaceholder: true },
    ];
    const again = parseRentCsv(rentRowsToCsv(withPlaceholder));
    expect(again.errors).toEqual([]);
    expect(again.rows).toEqual(withPlaceholder);
  });

  it('reports bad rows with line numbers and keeps good ones', () => {
    const bad = [
      'city,state,size_min,size_max,eur_per_m2,source,year,notes',
      'Leipzig,SN,60,80,abc,src,2026,',
      'Leipzig,XX,60,80,9,src,2026,',
      ',SN,60,80,9,src,2026,',
      'Leipzig,SN,80,60,9,src,2026,',
      'Leipzig,SN,60,80,9,src,2026,',
    ].join('\n');
    const { rows, errors } = parseRentCsv(bad);
    expect(rows).toHaveLength(1);
    expect(errors.map((e) => e.line)).toEqual([2, 3, 4, 5]);
  });

  it('missing columns → single header error', () => {
    expect(parseRentCsv('city,eur_per_m2\nLeipzig,9').errors).toEqual([
      { line: 1, message: 'missing column(s): state, size_min, size_max, source, year, notes' },
    ]);
  });

  it('the shipped template parses (header only, no rows)', () => {
    const t = readFileSync(new URL('../src/rent-reference.template.csv', import.meta.url), 'utf8');
    expect(parseRentCsv(t)).toEqual({ rows: [], errors: [] });
  });
});
