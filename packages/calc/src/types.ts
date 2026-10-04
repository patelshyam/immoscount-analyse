export type StateCode =
  | 'BW' | 'BY' | 'BE' | 'BB' | 'HB' | 'HH' | 'HE' | 'MV'
  | 'NI' | 'NW' | 'RP' | 'SL' | 'SN' | 'ST' | 'SH' | 'TH'; // prettier-ignore

export type PropertyType = 'apartment' | 'house' | 'multi_family';

/** All rates are decimal fractions (0.035 = 3.5 %), money in EUR. */
export interface PropertyInput {
  price: number;
  livingArea: number;
  rooms: number | null;
  propertyType: PropertyType;
  city: string | null;
  state: StateCode | null;
  hausgeldMonthly: number | null;
  actualColdRentMonthly: number | null;
  rentOverrideMonthly: number | null;
  brokerFeeOverride: number | null;
  renovationCost: number;
}

export interface Assumptions {
  targetNetYield: number;
  orangeBand: number;
  notaryAndRegistry: number;
  brokerFee: number;
  maintenancePerM2PerYear: number;
  vacancyRate: number;
  hausgeldNonRecoverableShare: number;
  managementMonthly: number;
  interestRate: number;
  initialRepayment: number;
  fixedRateYears: number;
  equityScenarios: number[];
  defaultEquityShare: number;
}

export interface TransferTaxEntry {
  state: StateCode;
  rate: number;
  /** ISO date; null = valid since forever */
  validFrom: string | null;
}

export interface RentRef {
  city: string;
  sizeMin: number;
  /** null = open-ended band */
  sizeMax: number | null;
  eurPerM2: number;
  source: string;
  year: number;
  isPlaceholder: boolean;
}

export interface ReferenceData {
  transferTax: TransferTaxEntry[];
  rentRefs: RentRef[];
}

export type Verdict = 'green' | 'orange' | 'red' | 'unknown';
export type RentSource = 'override' | 'actual' | 'reference' | 'placeholder_reference' | 'none';

export interface RentEstimate {
  monthlyRent: number;
  eurPerM2: number;
  isPlaceholder: boolean;
  source: string;
}

export interface Scenario {
  equityShare: number;
  equity: number;
  loan: number;
  annualDebtService: number;
  monthlyCashflow: number | null;
  monthlyCashflowExRepayment: number | null;
}

export interface NoiBreakdown {
  grossRentAnnual: number;
  vacancy: number;
  hausgeldNonRecoverable: number;
  maintenance: number;
  management: number;
  total: number;
}

export interface WhatIf {
  equityShare: number;
  breakEvenPrice: number | null;
  priceForTargetYield: number | null;
  requiredRentForTarget: number | null;
  requiredRentForZeroCashflow: number | null;
}

export interface Analysis {
  input: PropertyInput;
  assumptions: Assumptions;
  transferTaxRate: number;
  brokerFeeRate: number;
  /** k = 1 + g + n + b */
  costFactor: number;
  costs: {
    price: number;
    transferTax: number;
    notary: number;
    broker: number;
    renovation: number;
    total: number;
  };
  pricePerM2: number | null;
  rent: {
    monthly: number | null;
    source: RentSource;
    eurPerM2: number | null;
    reference: string | null;
  };
  grossYield: number | null;
  /** Annual fixed landlord costs: 12·Hnr + maintenance + 12·management */
  fixedCostsAnnual: number;
  noi: NoiBreakdown | null;
  netYield: number | null;
  scenarios: Scenario[];
  verdict: Verdict;
  whatIf: WhatIf;
  warnings: string[];
}
