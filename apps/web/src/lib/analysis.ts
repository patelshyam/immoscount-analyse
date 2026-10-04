import {
  amortizationSchedule,
  analyze,
  sensitivityGrid,
  type Assumptions,
  type PropertyInput,
  type ReferenceData,
} from '@immo/calc';

/** Analysis + mortgage schedule (loan at default equity) + sensitivity — all from @immo/calc. */
export function fullAnalysis(input: PropertyInput, a: Assumptions, ref: ReferenceData) {
  const analysis = analyze(input, a, ref);
  const loan =
    analysis.scenarios.find((s) => s.equityShare === a.defaultEquityShare)?.loan ??
    Math.max(0, analysis.costs.total - a.defaultEquityShare * input.price);
  return {
    analysis,
    schedule: amortizationSchedule(loan, a.interestRate, a.initialRepayment, a.fixedRateYears),
    sensitivity: sensitivityGrid(input, a, ref),
  };
}
