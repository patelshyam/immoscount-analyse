import type { Assumptions, StateCode } from '@immo/calc';
import { z } from 'zod';

export const STATE_CODES = [
  'BW', 'BY', 'BE', 'BB', 'HB', 'HH', 'HE', 'MV',
  'NI', 'NW', 'RP', 'SL', 'SN', 'ST', 'SH', 'TH',
] as const satisfies readonly StateCode[]; // prettier-ignore

export const STATE_NAMES: Record<StateCode, string> = {
  BW: 'Baden-Württemberg', BY: 'Bayern', BE: 'Berlin', BB: 'Brandenburg', HB: 'Bremen',
  HH: 'Hamburg', HE: 'Hessen', MV: 'Mecklenburg-Vorpommern', NI: 'Niedersachsen',
  NW: 'Nordrhein-Westfalen', RP: 'Rheinland-Pfalz', SL: 'Saarland', SN: 'Sachsen',
  ST: 'Sachsen-Anhalt', SH: 'Schleswig-Holstein', TH: 'Thüringen',
}; // prettier-ignore

export const stateCodeSchema = z.enum(STATE_CODES);
export const propertyTypeSchema = z.enum(['apartment', 'house', 'multi_family']);

const fraction = z.number().min(0).max(1);
const isoDate = z.iso.date();

export const assumptionsSchema = z.object({
  targetNetYield: fraction,
  orangeBand: fraction,
  notaryAndRegistry: fraction,
  brokerFee: fraction,
  maintenancePerM2PerYear: z.number().min(0).max(1000),
  vacancyRate: fraction.max(0.99),
  hausgeldNonRecoverableShare: fraction,
  managementMonthly: z.number().min(0).max(10_000),
  interestRate: fraction,
  initialRepayment: fraction,
  fixedRateYears: z.number().int().min(1).max(40),
  equityScenarios: z.array(fraction).min(1).max(6),
  defaultEquityShare: fraction,
}) satisfies z.ZodType<Assumptions>;

export const propertyInputSchema = z.object({
  price: z.number().positive().max(1e9),
  livingArea: z.number().positive().max(100_000),
  rooms: z.number().positive().max(1000).nullable().default(null),
  propertyType: propertyTypeSchema.default('apartment'),
  city: z.string().trim().min(1).max(200).nullable().default(null),
  state: stateCodeSchema.nullable().default(null),
  hausgeldMonthly: z.number().min(0).max(1e6).nullable().default(null),
  actualColdRentMonthly: z.number().min(0).max(1e7).nullable().default(null),
  rentOverrideMonthly: z.number().min(0).max(1e7).nullable().default(null),
  brokerFeeOverride: fraction.nullable().default(null),
  renovationCost: z.number().min(0).max(1e9).default(0),
});

export const transferTaxRowSchema = z.object({
  state: stateCodeSchema,
  rate: z.number().gt(0).lt(0.1),
  validFrom: isoDate.nullable(),
  verifiedOn: isoDate.nullable(),
  source: z.string().nullable(),
});

export const rentReferenceSchema = z
  .object({
    city: z.string().trim().min(1).max(200),
    sizeMin: z.number().min(0),
    sizeMax: z.number().positive().nullable(),
    eurPerM2: z.number().positive().max(200),
    source: z.string().trim().min(1).max(500),
    year: z.number().int().min(1990).max(2100),
    isPlaceholder: z.boolean().default(false),
    notes: z.string().max(2000).nullable().default(null),
  })
  .refine((r) => r.sizeMax === null || r.sizeMax > r.sizeMin, 'size_max must exceed size_min');

export type TransferTaxRow = z.infer<typeof transferTaxRowSchema>;
export type RentReferenceRow = z.infer<typeof rentReferenceSchema>;
