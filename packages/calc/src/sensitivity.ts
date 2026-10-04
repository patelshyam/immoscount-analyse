import { analyze } from './analyze';
import type { Assumptions, PropertyInput, ReferenceData } from './types';

export const SENSITIVITY_FACTORS = [-0.1, -0.05, 0, 0.05, 0.1];
export const INTEREST_DELTAS = [-0.01, -0.005, 0, 0.005, 0.01];

export interface SensitivityCell {
  priceFactor: number;
  rentFactor: number;
  netYield: number | null;
  monthlyCashflow: number | null;
}

export interface SensitivityResult {
  equityShare: number;
  /** grid[priceIdx][rentIdx] */
  grid: SensitivityCell[][];
  interest: { delta: number; interestRate: number; monthlyCashflow: number | null }[];
}

export function sensitivityGrid(
  input: PropertyInput,
  a: Assumptions,
  ref: ReferenceData,
): SensitivityResult {
  const at = { ...a, equityScenarios: [a.defaultEquityShare] };
  const baseRent = analyze(input, at, ref).rent.monthly;

  const grid = SENSITIVITY_FACTORS.map((pf) =>
    SENSITIVITY_FACTORS.map((rf): SensitivityCell => {
      if (baseRent == null)
        return { priceFactor: pf, rentFactor: rf, netYield: null, monthlyCashflow: null };
      const r = analyze(
        { ...input, price: input.price * (1 + pf), rentOverrideMonthly: baseRent * (1 + rf) },
        at,
        ref,
      );
      return {
        priceFactor: pf,
        rentFactor: rf,
        netYield: r.netYield,
        monthlyCashflow: r.scenarios[0]?.monthlyCashflow ?? null,
      };
    }),
  );

  const interest = INTEREST_DELTAS.map((delta) => {
    const interestRate = Math.max(0, a.interestRate + delta);
    const r = analyze(input, { ...at, interestRate }, ref);
    return { delta, interestRate, monthlyCashflow: r.scenarios[0]?.monthlyCashflow ?? null };
  });

  return { equityShare: a.defaultEquityShare, grid, interest };
}
