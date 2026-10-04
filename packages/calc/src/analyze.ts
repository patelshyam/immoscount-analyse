import { normalizeCityKey } from './city';
import type {
  Analysis,
  Assumptions,
  NoiBreakdown,
  PropertyInput,
  ReferenceData,
  RentEstimate,
  RentRef,
  RentSource,
  Scenario,
  StateCode,
  TransferTaxEntry,
  Verdict,
} from './types';

const pct = (x: number) => `${(x * 100).toFixed(2).replace('.', ',')} %`;
const positive = (x: number | null | undefined): x is number => x != null && x > 0;

/** Rate valid on `onDate` (ISO); unknown/missing state → highest rate in the table. */
export function transferTaxRate(
  state: StateCode | null,
  table: TransferTaxEntry[],
  onDate: string = new Date().toISOString().slice(0, 10),
): number {
  if (table.length === 0) throw new Error('Transfer tax table is empty');
  const current = table
    .filter((r) => r.state === state && (r.validFrom === null || r.validFrom <= onDate))
    .sort((a, b) => (a.validFrom ?? '').localeCompare(b.validFrom ?? ''));
  return current.at(-1)?.rate ?? Math.max(...table.map((r) => r.rate));
}

/** Matching size band for the city; real data beats placeholders, newer year beats older. */
export function estimateRent(
  city: string | null,
  livingArea: number,
  rentRefs: RentRef[],
): RentEstimate | null {
  if (!city || !(livingArea > 0)) return null;
  const key = normalizeCityKey(city);
  const best = rentRefs
    .filter(
      (r) =>
        normalizeCityKey(r.city) === key &&
        livingArea >= r.sizeMin &&
        (r.sizeMax === null || livingArea < r.sizeMax),
    )
    .sort((a, b) => Number(a.isPlaceholder) - Number(b.isPlaceholder) || b.year - a.year)[0];
  if (!best) return null;
  return {
    monthlyRent: best.eurPerM2 * livingArea,
    eurPerM2: best.eurPerM2,
    isPlaceholder: best.isPlaceholder,
    source: `${best.source} (${best.year})`,
  };
}

export function verdictFor(netYield: number | null, a: Assumptions): Verdict {
  if (netYield == null) return 'unknown';
  if (netYield >= a.targetNetYield) return 'green';
  if (netYield >= a.targetNetYield - a.orangeBand) return 'orange';
  return 'red';
}

const meaningful = (x: number) => (Number.isFinite(x) && x > 0 ? x : null);

/** Price at which monthly cashflow = 0 at equity share e: P = (NOI/(i+t) − R)/(k − e). */
export function breakEvenPrice(p: {
  noi: number | null;
  costFactor: number;
  renovation: number;
  interestRate: number;
  initialRepayment: number;
  equityShare: number;
}): number | null {
  const it = p.interestRate + p.initialRepayment;
  const ke = p.costFactor - p.equityShare;
  if (p.noi == null || it <= 0 || ke <= 0) return null;
  return meaningful((p.noi / it - p.renovation) / ke);
}

/** Price at which net yield = target: P = (NOI/target − R)/k. */
export function priceForTargetYield(p: {
  noi: number | null;
  costFactor: number;
  renovation: number;
  target: number;
}): number | null {
  if (p.noi == null || p.target <= 0 || p.costFactor <= 0) return null;
  return meaningful((p.noi / p.target - p.renovation) / p.costFactor);
}

/** Monthly cold rent for net yield = target: M = (target·C + fixed)/(12(1 − v)). */
export function requiredRentForTarget(p: {
  totalCost: number;
  fixedCostsAnnual: number;
  vacancyRate: number;
  target: number;
}): number | null {
  if (p.vacancyRate >= 1) return null;
  return meaningful((p.target * p.totalCost + p.fixedCostsAnnual) / (12 * (1 - p.vacancyRate)));
}

/** Monthly cold rent for cashflow = 0: M = (L(i + t) + fixed)/(12(1 − v)). */
export function requiredRentForZeroCashflow(p: {
  loan: number;
  interestRate: number;
  initialRepayment: number;
  fixedCostsAnnual: number;
  vacancyRate: number;
}): number | null {
  if (p.vacancyRate >= 1) return null;
  const ds = p.loan * (p.interestRate + p.initialRepayment);
  return meaningful((ds + p.fixedCostsAnnual) / (12 * (1 - p.vacancyRate)));
}

export function analyze(
  input: PropertyInput,
  a: Assumptions,
  ref: ReferenceData,
  onDate?: string,
): Analysis {
  const warnings: string[] = [];
  const P = input.price;
  const A = input.livingArea;
  const R = input.renovationCost ?? 0;

  // Costs
  const g = transferTaxRate(input.state, ref.transferTax, onDate);
  if (!input.state || !ref.transferTax.some((r) => r.state === input.state)) {
    warnings.push(`State unknown — using the highest transfer tax rate (${pct(g)}).`);
  }
  const n = a.notaryAndRegistry;
  const b = input.brokerFeeOverride ?? a.brokerFee;
  const k = 1 + g + n + b;
  const C = P * k + R;

  // Rent: override → actual → reference → none (0 counts as missing)
  let monthly: number | null = null;
  let source: RentSource = 'none';
  let eurPerM2: number | null = null;
  let reference: string | null = null;
  if (positive(input.rentOverrideMonthly)) {
    monthly = input.rentOverrideMonthly;
    source = 'override';
  } else if (positive(input.actualColdRentMonthly)) {
    monthly = input.actualColdRentMonthly;
    source = 'actual';
  } else {
    const est = estimateRent(input.city, A, ref.rentRefs);
    if (est) {
      monthly = est.monthlyRent;
      eurPerM2 = est.eurPerM2;
      reference = est.source;
      source = est.isPlaceholder ? 'placeholder_reference' : 'reference';
    }
  }
  if (monthly != null && A > 0 && eurPerM2 == null) eurPerM2 = monthly / A;
  if (source === 'none')
    warnings.push('No rent available — enter a rent to see yields and cashflow.');
  if (source === 'placeholder_reference') {
    warnings.push('Rent estimate is based on placeholder reference data, not real market data.');
  }

  // Landlord costs
  const isApartment = input.propertyType === 'apartment';
  if (isApartment && input.hausgeldMonthly == null)
    warnings.push('Hausgeld unknown — assumed 0 €.');
  const hnr = isApartment ? (input.hausgeldMonthly ?? 0) * a.hausgeldNonRecoverableShare : 0;
  const maintenance = a.maintenancePerM2PerYear * A;
  const management = 12 * a.managementMonthly;
  const fixedCostsAnnual = 12 * hnr + maintenance + management;

  let noi: NoiBreakdown | null = null;
  if (monthly != null) {
    const grossRentAnnual = 12 * monthly;
    const vacancy = grossRentAnnual * a.vacancyRate;
    noi = {
      grossRentAnnual,
      vacancy,
      hausgeldNonRecoverable: 12 * hnr,
      maintenance,
      management,
      total: grossRentAnnual - vacancy - fixedCostsAnnual,
    };
  }
  const grossYield = monthly != null && P > 0 ? (12 * monthly) / P : null;
  const netYield = noi && C > 0 ? noi.total / C : null;

  const i = a.interestRate;
  const t = a.initialRepayment;
  const scenarioFor = (e: number): Scenario => {
    const equity = e * P;
    const loan = Math.max(0, C - equity);
    const annualDebtService = loan * (i + t);
    return {
      equityShare: e,
      equity,
      loan,
      annualDebtService,
      monthlyCashflow: noi ? (noi.total - annualDebtService) / 12 : null,
      monthlyCashflowExRepayment: noi ? (noi.total - loan * i) / 12 : null,
    };
  };

  const e = a.defaultEquityShare;
  return {
    input,
    assumptions: a,
    transferTaxRate: g,
    brokerFeeRate: b,
    costFactor: k,
    costs: { price: P, transferTax: P * g, notary: P * n, broker: P * b, renovation: R, total: C },
    pricePerM2: A > 0 ? P / A : null,
    rent: { monthly, source, eurPerM2, reference },
    grossYield,
    fixedCostsAnnual,
    noi,
    netYield,
    scenarios: a.equityScenarios.map(scenarioFor),
    verdict: verdictFor(netYield, a),
    whatIf: {
      equityShare: e,
      breakEvenPrice: breakEvenPrice({
        noi: noi?.total ?? null,
        costFactor: k,
        renovation: R,
        interestRate: i,
        initialRepayment: t,
        equityShare: e,
      }),
      priceForTargetYield: priceForTargetYield({
        noi: noi?.total ?? null,
        costFactor: k,
        renovation: R,
        target: a.targetNetYield,
      }),
      requiredRentForTarget: requiredRentForTarget({
        totalCost: C,
        fixedCostsAnnual,
        vacancyRate: a.vacancyRate,
        target: a.targetNetYield,
      }),
      requiredRentForZeroCashflow: requiredRentForZeroCashflow({
        loan: scenarioFor(e).loan,
        interestRate: i,
        initialRepayment: t,
        fixedCostsAnnual,
        vacancyRate: a.vacancyRate,
      }),
    },
    warnings,
  };
}
