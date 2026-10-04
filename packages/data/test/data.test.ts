import { describe, expect, it } from 'vitest';
import { assumptionsSchema, DEFAULT_ASSUMPTIONS, STATE_CODES, TRANSFER_TAX } from '../src/index';

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
