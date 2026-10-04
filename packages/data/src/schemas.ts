import { z } from 'zod';

export const STATE_CODES = [
  'BW', 'BY', 'BE', 'BB', 'HB', 'HH', 'HE', 'MV',
  'NI', 'NW', 'RP', 'SL', 'SN', 'ST', 'SH', 'TH',
] as const; // prettier-ignore

export const stateCodeSchema = z.enum(STATE_CODES);

const fraction = z.number().min(0).max(1);
const isoDate = z.iso.date();

export const assumptionsSchema = z.object({
  targetNetYield: fraction,
  orangeBand: fraction,
  notaryAndRegistry: fraction,
  brokerFee: fraction,
  maintenancePerM2PerYear: z.number().min(0),
  vacancyRate: fraction,
  hausgeldNonRecoverableShare: fraction,
  managementMonthly: z.number().min(0),
  interestRate: fraction,
  initialRepayment: fraction,
  fixedRateYears: z.number().int().min(1).max(40),
  equityScenarios: z.array(fraction).min(1).max(6),
  defaultEquityShare: fraction,
});

export const transferTaxRowSchema = z.object({
  state: stateCodeSchema,
  rate: z.number().gt(0).lt(0.1),
  validFrom: isoDate.nullable(),
  verifiedOn: isoDate.nullable(),
  source: z.string().nullable(),
});

export type Assumptions = z.infer<typeof assumptionsSchema>;
export type TransferTaxRow = z.infer<typeof transferTaxRowSchema>;
