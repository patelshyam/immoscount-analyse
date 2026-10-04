import { describe, expect, it } from 'vitest';
import { parseGermanNumber } from '../src/index';

describe('parseGermanNumber', () => {
  it.each([
    ['349.000 €', 349000],
    ['78,5 m²', 78.5],
    ['3,5 Zi.', 3.5],
    ['1.250,50 €', 1250.5],
    ['1.234.567 €', 1234567],
    ['3.5', 3.5],
    ['300000', 300000],
    ['ca. 75 m²', 75],
    ['349.000,– €', 349000],
    ['1 250,50 €', 1250.5],
    ['Kaufpreis: 1.250 €', 1250],
    ['-12,5', -12.5],
  ])('%s → %s', (input, expected) => {
    expect(parseGermanNumber(input)).toBe(expected);
  });

  it.each([null, undefined, '', 'auf Anfrage', '€'])('%s → null', (input) => {
    expect(parseGermanNumber(input)).toBeNull();
  });
});
