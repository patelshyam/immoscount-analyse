import {
  fmtEur,
  fmtNum,
  fmtPct,
  verdictFor,
  type Analysis,
  type Schedule,
  type SensitivityResult,
} from '@immo/calc';
import { MortgageChart } from './MortgageChart';

const CELL = {
  green: 'bg-green-100 text-green-900',
  orange: 'bg-amber-100 text-amber-900',
  red: 'bg-red-100 text-red-900',
  unknown: 'bg-slate-100 text-slate-500',
};
const signed = (x: number) => (x > 0 ? `+${fmtPct(x, 0)}` : x < 0 ? fmtPct(x, 0) : '±0 %');

export function AnalysisTools({
  analysis,
  schedule,
  sensitivity,
}: {
  analysis: Analysis;
  schedule: Schedule;
  sensitivity: SensitivityResult;
}) {
  const a = analysis.assumptions;
  const loan = analysis.scenarios.find((s) => s.equityShare === a.defaultEquityShare)?.loan ?? 0;
  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h3 className="mb-1 text-sm font-semibold text-slate-700">
          Mortgage schedule — loan {fmtEur(loan)} at {fmtPct(a.defaultEquityShare, 0)} equity
        </h3>
        <p className="mb-3 text-xs text-slate-500">
          Rate {fmtEur(schedule.monthlyPayment, true)}/month ({fmtPct(a.interestRate)} interest +{' '}
          {fmtPct(a.initialRepayment)} Tilgung). After {a.fixedRateYears} years Zinsbindung:{' '}
          <strong>{fmtEur(schedule.balanceAfterFixedPeriod)}</strong> remaining,{' '}
          {fmtEur(schedule.interestInFixedPeriod)} interest paid. Paid off after{' '}
          {schedule.payoffYears == null
            ? 'never (repayment 0)'
            : `${fmtNum(schedule.payoffYears, 1)} years`}{' '}
          at a constant rate.
        </p>
        {schedule.rows.length > 0 ? (
          <>
            <MortgageChart rows={schedule.rows} fixedRateYears={a.fixedRateYears} />
            <details className="mt-2 text-sm">
              <summary className="cursor-pointer text-slate-600">Yearly table</summary>
              <table className="mt-2 w-full tabular-nums">
                <thead className="text-left text-xs uppercase text-slate-500">
                  <tr>
                    <th className="py-1">Year</th>
                    <th className="py-1 text-right">Interest</th>
                    <th className="py-1 text-right">Tilgung</th>
                    <th className="py-1 text-right">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {schedule.rows.map((r) => (
                    <tr
                      key={r.year}
                      className={`border-t border-slate-100 ${r.year === a.fixedRateYears ? 'font-semibold' : ''}`}
                    >
                      <td className="py-1">{r.year}</td>
                      <td className="py-1 text-right">{fmtEur(r.interest)}</td>
                      <td className="py-1 text-right">{fmtEur(r.principal)}</td>
                      <td className="py-1 text-right">{fmtEur(r.endBalance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          </>
        ) : (
          <p className="text-sm text-slate-500">No loan needed at this equity share.</p>
        )}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h3 className="mb-1 text-sm font-semibold text-slate-700">
          Sensitivity — net yield and cashflow/month at {fmtPct(sensitivity.equityShare, 0)} equity
        </h3>
        {analysis.rent.monthly == null ? (
          <p className="text-sm text-slate-500">Needs a rent.</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-center text-xs tabular-nums">
                <thead>
                  <tr>
                    <th className="p-1 text-left text-slate-500">Price ↓ / Rent →</th>
                    {sensitivity.grid[0]!.map((c) => (
                      <th key={c.rentFactor} className="p-1 font-medium text-slate-600">
                        {signed(c.rentFactor)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sensitivity.grid.map((row) => (
                    <tr key={row[0]!.priceFactor}>
                      <th className="p-1 text-left font-medium text-slate-600">
                        {signed(row[0]!.priceFactor)}
                      </th>
                      {row.map((c) => (
                        <td
                          key={c.rentFactor}
                          className={`p-1.5 ${CELL[verdictFor(c.netYield, a)]} ${c.priceFactor === 0 && c.rentFactor === 0 ? 'ring-2 ring-slate-900 ring-inset' : ''}`}
                        >
                          <div className="font-semibold">{fmtPct(c.netYield)}</div>
                          <div>{fmtEur(c.monthlyCashflow)}</div>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <h4 className="mt-4 mb-1 text-xs font-semibold uppercase text-slate-500">
              Interest rate change
            </h4>
            <table className="w-full text-center text-xs tabular-nums">
              <tbody>
                <tr>
                  {sensitivity.interest.map((x) => (
                    <th key={x.delta} className="p-1 font-medium text-slate-600">
                      {x.delta > 0 ? '+' : ''}
                      {fmtNum(x.delta * 100, 1)} pp ({fmtPct(x.interestRate)})
                    </th>
                  ))}
                </tr>
                <tr>
                  {sensitivity.interest.map((x) => (
                    <td
                      key={x.delta}
                      className={`p-1.5 ${(x.monthlyCashflow ?? 0) < 0 ? 'text-red-700' : 'text-green-700'}`}
                    >
                      {fmtEur(x.monthlyCashflow)}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </>
        )}
      </section>
    </div>
  );
}
