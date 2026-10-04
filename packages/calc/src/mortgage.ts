export interface ScheduleRow {
  year: number;
  interest: number;
  principal: number;
  endBalance: number;
}

export interface Schedule {
  monthlyPayment: number;
  rows: ScheduleRow[];
  balanceAfterFixedPeriod: number;
  interestInFixedPeriod: number;
  /** null = never paid off at a constant rate (e.g. repayment 0) */
  payoffYears: number | null;
}

const MAX_YEARS = 100;

/** Annuity loan: constant payment L·(i + t)/12, monthly interest on the remaining balance. */
export function amortizationSchedule(
  loan: number,
  interestRate: number,
  initialRepayment: number,
  fixedRateYears: number,
): Schedule {
  const payment = (loan * (interestRate + initialRepayment)) / 12;
  const rows: ScheduleRow[] = [];
  let balance = loan;
  let months = 0;

  while (balance > 1e-6 && rows.length < MAX_YEARS) {
    const row: ScheduleRow = { year: rows.length + 1, interest: 0, principal: 0, endBalance: 0 };
    for (let m = 0; m < 12 && balance > 1e-6; m++) {
      const interest = (balance * interestRate) / 12;
      const principal = Math.min(payment - interest, balance);
      if (principal <= 0) break; // payment doesn't cover interest — never pays off
      row.interest += interest;
      row.principal += principal;
      balance -= principal;
      months++;
    }
    row.endBalance = Math.max(0, balance);
    if (row.principal === 0 && row.interest === 0) break;
    rows.push(row);
  }

  const fixed = rows.slice(0, fixedRateYears);
  const paidOff = balance <= 1e-6;
  return {
    monthlyPayment: payment,
    rows,
    balanceAfterFixedPeriod: fixed.at(-1)?.endBalance ?? loan,
    interestInFixedPeriod: fixed.reduce((s, r) => s + r.interest, 0),
    payoffYears: paidOff ? months / 12 : null,
  };
}
