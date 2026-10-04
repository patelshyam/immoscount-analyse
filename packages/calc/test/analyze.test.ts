import { describe, expect, it } from 'vitest';
import {
  analyze,
  breakEvenPrice,
  estimateRent,
  normalizeCityKey,
  priceForTargetYield,
  requiredRentForTarget,
  requiredRentForZeroCashflow,
  shortCityKey,
  transferTaxRate,
  verdictFor,
  type Assumptions,
  type PropertyInput,
  type ReferenceData,
  type RentRef,
} from '../src/index';

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
  transferTax: [
    { state: 'HE', rate: 0.06, validFrom: null },
    { state: 'BY', rate: 0.035, validFrom: null },
    { state: 'NW', rate: 0.065, validFrom: null },
  ],
  rentRefs: [],
};

const GOLDEN: PropertyInput = {
  price: 300_000,
  livingArea: 75,
  rooms: 3,
  propertyType: 'apartment',
  city: 'Frankfurt am Main',
  state: 'HE',
  hausgeldMonthly: 300,
  actualColdRentMonthly: 1000,
  rentOverrideMonthly: null,
  brokerFeeOverride: 0.0357,
  renovationCost: 0,
};

const money = (actual: number | null | undefined, expected: number, tol = 0.01) => {
  expect(actual).not.toBeNull();
  expect(Math.abs((actual as number) - expected)).toBeLessThanOrEqual(tol);
};

describe('golden case (SPEC §5.9)', () => {
  const r = analyze(GOLDEN, A, REF);

  it('costs', () => {
    money(r.costFactor, 1.1157, 1e-9);
    money(r.costs.total, 334_710);
    money(r.pricePerM2, 4000);
  });

  it('yields and NOI', () => {
    expect(r.rent.source).toBe('actual');
    money((r.grossYield ?? 0) * 100, 4.0);
    money(r.noi?.total, 9480);
    money(r.noi?.grossRentAnnual, 12_000);
    money(r.noi?.vacancy, 360);
    money(r.noi?.hausgeldNonRecoverable, 1260);
    money(r.noi?.maintenance, 900);
    money((r.netYield ?? 0) * 100, 2.832, 0.001);
  });

  it('scenarios', () => {
    money(r.scenarios[0]?.monthlyCashflow, -744.09);
    money(r.scenarios[1]?.loan, 304_710);
    money(r.scenarios[1]?.monthlyCashflow, -606.59);
    money(r.scenarios[2]?.monthlyCashflow, -469.09);
    money(r.scenarios[1]?.monthlyCashflowExRepayment, -98.74);
  });

  it('verdict and what-if', () => {
    expect(r.verdict).toBe('red');
    money(r.whatIf.breakEvenPrice, 169_699, 1);
    money(r.whatIf.priceForTargetYield, 212_423, 1);
    money(r.whatIf.requiredRentForTarget, 1335.77);
    expect(r.warnings).toEqual([]);
  });

  it('break-even price really gives zero cashflow at 10 % equity', () => {
    const be = analyze({ ...GOLDEN, price: r.whatIf.breakEvenPrice! }, A, REF);
    money(be.scenarios[1]?.monthlyCashflow, 0);
  });

  it('price for target yield really gives the target net yield', () => {
    const at = analyze({ ...GOLDEN, price: r.whatIf.priceForTargetYield! }, A, REF);
    money(at.netYield, 0.04, 1e-9);
  });

  it('required rents really hit the target / zero cashflow', () => {
    const t = analyze({ ...GOLDEN, rentOverrideMonthly: r.whatIf.requiredRentForTarget }, A, REF);
    money(t.netYield, 0.04, 1e-9);
    const z = analyze(
      { ...GOLDEN, rentOverrideMonthly: r.whatIf.requiredRentForZeroCashflow },
      A,
      REF,
    );
    money(z.scenarios[1]?.monthlyCashflow, 0);
  });
});

describe('edge cases', () => {
  it('missing rent → null yields, unknown verdict, warning', () => {
    const r = analyze({ ...GOLDEN, actualColdRentMonthly: null }, A, REF);
    expect(r.rent.source).toBe('none');
    expect(r.grossYield).toBeNull();
    expect(r.netYield).toBeNull();
    expect(r.noi).toBeNull();
    expect(r.scenarios[1]?.monthlyCashflow).toBeNull();
    expect(r.scenarios[1]?.loan).toBeCloseTo(304_710, 2);
    expect(r.verdict).toBe('unknown');
    expect(r.whatIf.breakEvenPrice).toBeNull();
    expect(r.whatIf.requiredRentForTarget).not.toBeNull();
    expect(r.warnings.some((w) => w.includes('No rent'))).toBe(true);
  });

  it('zero rent counts as missing', () => {
    const r = analyze({ ...GOLDEN, actualColdRentMonthly: 0, rentOverrideMonthly: 0 }, A, REF);
    expect(r.rent.source).toBe('none');
    expect(r.verdict).toBe('unknown');
  });

  it('override beats actual rent', () => {
    const r = analyze({ ...GOLDEN, rentOverrideMonthly: 1200 }, A, REF);
    expect(r.rent).toMatchObject({ monthly: 1200, source: 'override' });
  });

  it('missing Hausgeld on an apartment → 0 + warning', () => {
    const r = analyze({ ...GOLDEN, hausgeldMonthly: null }, A, REF);
    money(r.noi?.hausgeldNonRecoverable, 0);
    money(r.noi?.total, 11_640 - 900);
    expect(r.warnings.some((w) => w.includes('Hausgeld'))).toBe(true);
  });

  it('house ignores Hausgeld, no warning', () => {
    const r = analyze({ ...GOLDEN, propertyType: 'house', hausgeldMonthly: null }, A, REF);
    money(r.noi?.hausgeldNonRecoverable, 0);
    expect(r.warnings).toEqual([]);
    const withHg = analyze({ ...GOLDEN, propertyType: 'house', hausgeldMonthly: 300 }, A, REF);
    money(withHg.noi?.hausgeldNonRecoverable, 0);
  });

  it('equity ≥ total cost → loan 0, cashflow = NOI/12', () => {
    const r = analyze(GOLDEN, { ...A, equityScenarios: [1.2] }, REF);
    expect(r.scenarios[0]?.loan).toBe(0);
    money(r.scenarios[0]?.monthlyCashflow, 9480 / 12);
    money(r.scenarios[0]?.monthlyCashflowExRepayment, 9480 / 12);
  });

  it('interest rate 0 → debt service is repayment only', () => {
    const r = analyze(GOLDEN, { ...A, interestRate: 0 }, REF);
    money(r.scenarios[1]?.annualDebtService, 304_710 * 0.02);
    money(r.scenarios[1]?.monthlyCashflowExRepayment, 9480 / 12);
  });

  it('unknown state → highest rate + warning', () => {
    const r = analyze({ ...GOLDEN, state: null }, A, REF);
    expect(r.transferTaxRate).toBe(0.065);
    expect(r.warnings.some((w) => w.includes('State unknown'))).toBe(true);
    const missing = analyze({ ...GOLDEN, state: 'SN' }, A, REF);
    expect(missing.transferTaxRate).toBe(0.065);
    expect(missing.warnings.some((w) => w.includes('State unknown'))).toBe(true);
  });

  it('renovation cost is added to total cost and what-if prices', () => {
    const R = 20_000;
    const r = analyze({ ...GOLDEN, renovationCost: R }, A, REF);
    money(r.costs.total, 334_710 + R);
    money(r.costs.renovation, R);
    money(r.netYield, 9480 / (334_710 + R), 1e-9);
    money(r.whatIf.breakEvenPrice, (9480 / 0.055 - R) / (1.1157 - 0.1), 1);
    money(r.whatIf.priceForTargetYield, (9480 / 0.04 - R) / 1.1157, 1);
    const be = analyze({ ...GOLDEN, renovationCost: R, price: r.whatIf.breakEvenPrice! }, A, REF);
    money(be.scenarios[1]?.monthlyCashflow, 0);
  });

  it('broker fee override 0 (provisionsfrei)', () => {
    const r = analyze({ ...GOLDEN, brokerFeeOverride: 0 }, A, REF);
    money(r.costFactor, 1.08, 1e-9);
    money(r.costs.broker, 0);
  });

  it('null broker fee override falls back to the default', () => {
    const r = analyze({ ...GOLDEN, brokerFeeOverride: null }, A, REF);
    expect(r.brokerFeeRate).toBe(0.0357);
  });
});

describe('verdictFor', () => {
  it('bands', () => {
    expect(verdictFor(null, A)).toBe('unknown');
    expect(verdictFor(0.04, A)).toBe('green');
    expect(verdictFor(0.036, A)).toBe('orange');
    expect(verdictFor(0.035, A)).toBe('orange');
    expect(verdictFor(0.0349, A)).toBe('red');
  });
});

describe('what-if helpers return null when not meaningful', () => {
  it('negative or impossible results', () => {
    const base = { costFactor: 1.1157, renovation: 0, interestRate: 0.035, initialRepayment: 0.02 };
    expect(breakEvenPrice({ ...base, noi: -1000, equityShare: 0.1 })).toBeNull();
    expect(breakEvenPrice({ ...base, noi: 9480, equityShare: 2 })).toBeNull();
    expect(breakEvenPrice({ ...base, noi: 9480, interestRate: 0, initialRepayment: 0, equityShare: 0.1 })).toBeNull(); // prettier-ignore
    expect(breakEvenPrice({ ...base, noi: 1000, renovation: 1e6, equityShare: 0.1 })).toBeNull();
    expect(
      priceForTargetYield({ noi: 9480, costFactor: 1.1157, renovation: 0, target: 0 }),
    ).toBeNull();
    expect(
      priceForTargetYield({ noi: null, costFactor: 1.1157, renovation: 0, target: 0.04 }),
    ).toBeNull();
    expect(requiredRentForTarget({ totalCost: 1, fixedCostsAnnual: 0, vacancyRate: 1, target: 0.04 })).toBeNull(); // prettier-ignore
    expect(requiredRentForZeroCashflow({ loan: 0, interestRate: 0.03, initialRepayment: 0.02, fixedCostsAnnual: 0, vacancyRate: 0.03 })).toBeNull(); // prettier-ignore
  });

  it('zero-cashflow rent at golden 10 % equity', () => {
    const m = requiredRentForZeroCashflow({
      loan: 304_710,
      interestRate: 0.035,
      initialRepayment: 0.02,
      fixedCostsAnnual: 2160,
      vacancyRate: 0.03,
    });
    money(m, (304_710 * 0.055 + 2160) / (12 * 0.97));
  });
});

describe('transferTaxRate', () => {
  const table = [
    { state: 'TH' as const, rate: 0.065, validFrom: null },
    { state: 'TH' as const, rate: 0.05, validFrom: '2024-01-01' },
    { state: 'BY' as const, rate: 0.035, validFrom: null },
  ];
  it('picks the rate valid on the given date', () => {
    expect(transferTaxRate('TH', table, '2023-12-31')).toBe(0.065);
    expect(transferTaxRate('TH', table, '2024-01-01')).toBe(0.05);
    expect(transferTaxRate('BY', table, '2026-10-04')).toBe(0.035);
  });
  it('unknown state → highest rate', () => {
    expect(transferTaxRate(null, table)).toBe(0.065);
    expect(transferTaxRate('HE', table)).toBe(0.065);
  });
  it('empty table throws', () => {
    expect(() => transferTaxRate('BY', [])).toThrow();
  });
});

describe('estimateRent', () => {
  const refs: RentRef[] = [
    { city: 'Leipzig', sizeMin: 60, sizeMax: 80, eurPerM2: 9, source: 'demo', year: 2025, isPlaceholder: true }, // prettier-ignore
    { city: 'Leipzig', sizeMin: 60, sizeMax: 80, eurPerM2: 8, source: 'Mietspiegel', year: 2024, isPlaceholder: false }, // prettier-ignore
    { city: 'Leipzig', sizeMin: 60, sizeMax: 80, eurPerM2: 8.5, source: 'Mietspiegel', year: 2026, isPlaceholder: false }, // prettier-ignore
    { city: 'Leipzig', sizeMin: 100, sizeMax: null, eurPerM2: 7, source: 'Mietspiegel', year: 2026, isPlaceholder: false }, // prettier-ignore
    { city: 'Düsseldorf', sizeMin: 40, sizeMax: 60, eurPerM2: 10, source: 'demo', year: 2025, isPlaceholder: true }, // prettier-ignore
  ];
  it('prefers real data and the newest year', () => {
    expect(estimateRent('Leipzig', 70, refs)).toEqual({
      monthlyRent: 595,
      eurPerM2: 8.5,
      isPlaceholder: false,
      source: 'Mietspiegel (2026)',
    });
  });
  it('band edges: min inclusive, max exclusive, open-ended top band', () => {
    expect(estimateRent('Leipzig', 80, refs)).toBeNull();
    expect(estimateRent('Leipzig', 60, refs)?.eurPerM2).toBe(8.5);
    expect(estimateRent('Leipzig', 250, refs)?.eurPerM2).toBe(7);
  });
  it('matches normalized city names and flags placeholders', () => {
    expect(estimateRent('DUESSELDORF', 50, refs)).toMatchObject({ isPlaceholder: true, monthlyRent: 500 }); // prettier-ignore
  });
  it('no match / no city / no area → null', () => {
    expect(estimateRent('Berlin', 70, refs)).toBeNull();
    expect(estimateRent(null, 70, refs)).toBeNull();
    expect(estimateRent('Leipzig', 0, refs)).toBeNull();
  });
  it('analyze uses the reference and labels placeholder sources', () => {
    const r = analyze({ ...GOLDEN, city: 'Düsseldorf', livingArea: 50, actualColdRentMonthly: null }, A, { ...REF, rentRefs: refs }); // prettier-ignore
    expect(r.rent).toMatchObject({ monthly: 500, source: 'placeholder_reference' });
    expect(r.warnings.some((w) => w.includes('placeholder'))).toBe(true);
    const real = analyze({ ...GOLDEN, city: 'Leipzig', actualColdRentMonthly: null }, A, { ...REF, rentRefs: refs }); // prettier-ignore
    expect(real.rent.source).toBe('reference');
  });
});

describe('city keys', () => {
  it('normalizes umlauts, ß, punctuation', () => {
    expect(normalizeCityKey('Düsseldorf')).toBe('duesseldorf');
    expect(normalizeCityKey('Gießen')).toBe('giessen');
    expect(normalizeCityKey('Halle (Saale)')).toBe('halle saale');
    expect(normalizeCityKey('St. Ingbert')).toBe('st ingbert');
    expect(normalizeCityKey('  Castrop-Rauxel ')).toBe('castrop rauxel');
  });
  it('short keys drop qualifiers', () => {
    expect(shortCityKey('Frankfurt am Main')).toBe('frankfurt');
    expect(shortCityKey('Frankfurt (Oder)')).toBe('frankfurt');
    expect(shortCityKey('Mülheim an der Ruhr')).toBe('muelheim');
    expect(shortCityKey('Freiburg im Breisgau')).toBe('freiburg');
    expect(shortCityKey('Berlin')).toBe('berlin');
  });
});
