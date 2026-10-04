import { describe, expect, it } from 'vitest';
import { parseBrokerFee, parseGermanNumber, readJsonLd } from '../src/parsers/common';

describe('German number parsing (SPEC §6.3)', () => {
  it.each([
    ['349.000 €', 349000],
    ['78,5 m²', 78.5],
    ['3,5 Zi.', 3.5],
    ['1.250,50 €', 1250.5],
  ])('%s → %s', (s, n) => expect(parseGermanNumber(s)).toBe(n));
});

describe('parseBrokerFee', () => {
  it.each([
    ['provisionsfrei', 0],
    ['Provisionsfrei für Käufer', 0],
    ['keine Käuferprovision', 0],
    ['3,57 % inkl. MwSt.', 0.0357],
    ['Käuferprovision: 2,38% (inkl. MwSt.)', 0.0238],
    ['nach Vereinbarung', null],
    [null, null],
  ])('%s → %s', (s, n) => {
    const r = parseBrokerFee(s);
    if (n === null) expect(r).toBeNull();
    else expect(r).toBeCloseTo(n, 10);
  });
});

describe('readJsonLd', () => {
  it('flattens arrays and @graph, skips malformed blocks', () => {
    document.body.innerHTML = `
      <script type="application/ld+json">{"@type":"Offer","price":1}</script>
      <script type="application/ld+json">[{"@type":"A"},{"@graph":[{"@type":"B"}]}]</script>
      <script type="application/ld+json">{ broken</script>`;
    expect(readJsonLd(document).map((x) => x['@type'] ?? 'graph')).toEqual([
      'Offer',
      'A',
      'graph',
      'B',
    ]);
  });
});
