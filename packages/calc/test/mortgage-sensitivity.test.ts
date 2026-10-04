import { describe, expect, it } from 'vitest';
import {
  amortizationSchedule,
  analyze,
  sensitivityGrid,
  type Assumptions,
  type PropertyInput,
  type ReferenceData,
} from '../src/index';

/** Closed-form annuity balance after n months. */
const balanceAfter = (L: number, i: number, t: number, n: number) => {
  const r = i / 12;
  const pmt = (L * (i + t)) / 12;
  return L * (1 + r) ** n - (pmt * ((1 + r) ** n - 1)) / r;
};

describe('amortizationSchedule', () => {
  const s = amortizationSchedule(304_710, 0.035, 0.02, 10);

  it('constant payment and closed-form balances', () => {
    expect(s.monthlyPayment).toBeCloseTo((304_710 * 0.055) / 12, 6);
    expect(s.rows[0]?.endBalance).toBeCloseTo(balanceAfter(304_710, 0.035, 0.02, 12), 4);
    expect(s.balanceAfterFixedPeriod).toBeCloseTo(balanceAfter(304_710, 0.035, 0.02, 120), 4);
  });

  it('interest + principal add up', () => {
    const yearPaid = (s.rows[0]?.interest ?? 0) + (s.rows[0]?.principal ?? 0);
    expect(yearPaid).toBeCloseTo(s.monthlyPayment * 12, 6);
    const principalTotal = s.rows.reduce((x, r) => x + r.principal, 0);
    expect(principalTotal).toBeCloseTo(304_710, 4);
    const fixedInterest = s.rows.slice(0, 10).reduce((x, r) => x + r.interest, 0);
    expect(s.interestInFixedPeriod).toBeCloseTo(fixedInterest, 6);
  });

  it('payoff years match the closed form', () => {
    const r = 0.035 / 12;
    const months = Math.ceil(-Math.log(1 - 0.035 / 0.055) / Math.log(1 + r));
    expect(s.payoffYears).toBeCloseTo(months / 12, 6);
    expect(s.rows.at(-1)?.endBalance).toBe(0);
  });

  it('loan 0', () => {
    const z = amortizationSchedule(0, 0.035, 0.02, 10);
    expect(z).toEqual({
      monthlyPayment: 0,
      rows: [],
      balanceAfterFixedPeriod: 0,
      interestInFixedPeriod: 0,
      payoffYears: 0,
    });
  });

  it('interest 0 → linear repayment, payoff = 1/t years', () => {
    const z = amortizationSchedule(120_000, 0, 0.02, 10);
    expect(z.interestInFixedPeriod).toBe(0);
    expect(z.balanceAfterFixedPeriod).toBeCloseTo(120_000 * 0.8, 6);
    expect(z.payoffYears).toBeCloseTo(50, 6);
  });

  it('repayment 0 → never paid off', () => {
    const z = amortizationSchedule(100_000, 0.03, 0, 10);
    expect(z.payoffYears).toBeNull();
    expect(z.balanceAfterFixedPeriod).toBe(100_000);
  });
});

const A: Assumptions = {
  targetNetYield: 0.04,
  orangeBand: 0.005,
  notaryAndRegistry: 0.02,
  brokerFee: 0.0357,
  maintenancePerM2PerYear: 12,
  vacancyRate: 0.03,
  hausgeldNonRecoverableShare: 0.35,
  managementMonthly: 0,
  interestRate: 0.035,
  initialRepayment: 0.02,
  fixedRateYears: 10,
  equityScenarios: [0, 0.1, 0.2],
  defaultEquityShare: 0.1,
};
const REF: ReferenceData = {
  transferTax: [{ state: 'HE', rate: 0.06, validFrom: null }],
  rentRefs: [],
};
const INPUT: PropertyInput = {
  price: 300_000,
  livingArea: 75,
  rooms: 3,
  propertyType: 'apartment',
  city: null,
  state: 'HE',
  hausgeldMonthly: 300,
  actualColdRentMonthly: 1000,
  rentOverrideMonthly: null,
  brokerFeeOverride: null,
  renovationCost: 0,
};

describe('sensitivityGrid', () => {
  const s = sensitivityGrid(INPUT, A, REF);

  it('5×5 grid, centre equals the base analysis', () => {
    expect(s.grid).toHaveLength(5);
    expect(s.grid.every((row) => row.length === 5)).toBe(true);
    const base = analyze(INPUT, A, REF);
    expect(s.grid[2]?.[2]?.netYield).toBeCloseTo(base.netYield!, 12);
    expect(s.grid[2]?.[2]?.monthlyCashflow).toBeCloseTo(base.scenarios[1]!.monthlyCashflow!, 9);
  });

  it('cells match a direct analysis', () => {
    const cell = s.grid[0]?.[4]; // price −10 %, rent +10 %
    const direct = analyze({ ...INPUT, price: 270_000, rentOverrideMonthly: 1100 }, A, REF);
    expect(cell?.netYield).toBeCloseTo(direct.netYield!, 12);
    expect(cell?.monthlyCashflow).toBeCloseTo(direct.scenarios[1]!.monthlyCashflow!, 9);
  });

  it('interest deltas: higher rate → lower cashflow; floored at 0', () => {
    const cfs = s.interest.map((x) => x.monthlyCashflow!);
    expect([...cfs].sort((a, b) => b - a)).toEqual(cfs);
    expect(s.interest[2]?.interestRate).toBe(0.035);
    const low = sensitivityGrid(INPUT, { ...A, interestRate: 0.005 }, REF);
    expect(low.interest[0]?.interestRate).toBe(0);
  });

  it('no rent → null cells', () => {
    const n = sensitivityGrid({ ...INPUT, actualColdRentMonthly: null }, A, REF);
    expect(n.grid.flat().every((c) => c.netYield === null && c.monthlyCashflow === null)).toBe(
      true,
    );
  });
});
