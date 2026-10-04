import type { Assumptions } from './schemas';

// Starting defaults from SPEC §5.2 — editable in Settings, not facts.
export const DEFAULT_ASSUMPTIONS: Assumptions = {
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

export const DEFAULT_PIPELINE_STATUSES = [
  { name: 'New', color: '#64748b', kind: 'open' },
  { name: 'Analyzing', color: '#0ea5e9', kind: 'open' },
  { name: 'Viewing scheduled', color: '#8b5cf6', kind: 'open' },
  { name: 'Offer made', color: '#f59e0b', kind: 'open' },
  { name: 'Financing', color: '#14b8a6', kind: 'open' },
  { name: 'Notary appointment', color: '#22c55e', kind: 'open' },
  { name: 'Closed', color: '#15803d', kind: 'closed' },
  { name: 'Rejected', color: '#ef4444', kind: 'excluded' },
] as const;
