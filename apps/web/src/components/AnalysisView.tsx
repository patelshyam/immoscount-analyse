import type { Analysis, RentSource, Verdict } from '@immo/calc';
import type { ReactNode } from 'react';
import { fmtEur, fmtNum, fmtPct } from '@immo/calc';

const VERDICT: Record<Verdict, { label: string; cls: string }> = {
  green: { label: 'Meets target', cls: 'bg-green-100 text-green-800 ring-green-600/30' },
  orange: { label: 'Close to target', cls: 'bg-amber-100 text-amber-800 ring-amber-600/30' },
  red: { label: 'Below target', cls: 'bg-red-100 text-red-800 ring-red-600/30' },
  unknown: { label: 'Unknown', cls: 'bg-slate-100 text-slate-700 ring-slate-500/30' },
};

const RENT_SOURCE: Record<RentSource, { label: string; cls: string }> = {
  override: { label: 'manual', cls: 'bg-sky-100 text-sky-800' },
  actual: { label: 'actual', cls: 'bg-green-100 text-green-800' },
  reference: { label: 'estimated', cls: 'bg-indigo-100 text-indigo-800' },
  placeholder_reference: { label: 'placeholder rent data', cls: 'bg-amber-100 text-amber-900' },
  none: { label: 'missing', cls: 'bg-slate-200 text-slate-700' },
};

export function VerdictPill({ verdict }: { verdict: Verdict }) {
  const v = VERDICT[verdict];
  return (
    <span className={`rounded-full px-3 py-1 text-sm font-medium ring-1 ${v.cls}`}>{v.label}</span>
  );
}

export function RentSourceBadge({ source }: { source: RentSource }) {
  const s = RENT_SOURCE[source];
  return <span className={`rounded px-2 py-0.5 text-xs font-medium ${s.cls}`}>{s.label}</span>;
}

function Metric({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-xl font-semibold tabular-nums">{value}</div>
      {hint && <div className="mt-1 text-xs text-slate-500">{hint}</div>}
    </div>
  );
}

function Rows({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <table className="w-full text-sm">
      <tbody>
        {rows.map(([k, v]) => (
          <tr key={k} className="border-b border-slate-100 last:border-0">
            <td className="py-1.5 text-slate-600">{k}</td>
            <td className="py-1.5 text-right tabular-nums">{v}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <h3 className="mb-2 text-sm font-semibold text-slate-700">{title}</h3>
      {children}
    </section>
  );
}

export function AnalysisView({ analysis: r }: { analysis: Analysis }) {
  const a = r.assumptions;
  const def = r.scenarios.find((s) => s.equityShare === a.defaultEquityShare) ?? r.scenarios[0];
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <VerdictPill verdict={r.verdict} />
        <span className="text-sm text-slate-600">
          Target net yield {fmtPct(a.targetNetYield)} · state {r.input.state ?? 'unknown'} ·
          transfer tax {fmtPct(r.transferTaxRate)}
        </span>
      </div>

      {r.warnings.length > 0 && (
        <ul className="space-y-1 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          {r.warnings.map((w) => (
            <li key={w}>⚠ {w}</li>
          ))}
        </ul>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Metric label="Gross yield" value={fmtPct(r.grossYield)} />
        <Metric label="Net yield" value={fmtPct(r.netYield)} />
        <Metric
          label="Cashflow / month"
          value={fmtEur(def?.monthlyCashflow ?? null)}
          hint={`at ${fmtPct(def?.equityShare ?? 0, 0)} equity`}
        />
        <Metric label="Price / m²" value={fmtEur(r.pricePerM2)} />
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-slate-600">Kaltmiete used:</span>
        <span className="font-semibold tabular-nums">{fmtEur(r.rent.monthly, true)}</span>
        {r.rent.eurPerM2 != null && (
          <span className="text-slate-500">({fmtEur(r.rent.eurPerM2, true)}/m²)</span>
        )}
        <RentSourceBadge source={r.rent.source} />
        {r.rent.reference && <span className="text-xs text-slate-500">{r.rent.reference}</span>}
      </div>

      <Card title="Financing scenarios">
        <table className="w-full text-sm tabular-nums">
          <thead className="text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="py-1">Equity</th>
              <th className="py-1 text-right">Equity €</th>
              <th className="py-1 text-right">Loan</th>
              <th className="py-1 text-right">Debt service / yr</th>
              <th className="py-1 text-right">Cashflow / mo</th>
              <th className="py-1 text-right">ex repayment / mo</th>
            </tr>
          </thead>
          <tbody>
            {r.scenarios.map((s) => (
              <tr key={s.equityShare} className="border-t border-slate-100">
                <td className="py-1.5">{fmtPct(s.equityShare, 0)}</td>
                <td className="py-1.5 text-right">{fmtEur(s.equity)}</td>
                <td className="py-1.5 text-right">{fmtEur(s.loan)}</td>
                <td className="py-1.5 text-right">{fmtEur(s.annualDebtService)}</td>
                <td
                  className={`py-1.5 text-right ${(s.monthlyCashflow ?? 0) < 0 ? 'text-red-700' : ''}`}
                >
                  {fmtEur(s.monthlyCashflow, true)}
                </td>
                <td className="py-1.5 text-right">{fmtEur(s.monthlyCashflowExRepayment, true)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-xs text-slate-500">
          Interest {fmtPct(a.interestRate)} + initial repayment {fmtPct(a.initialRepayment)}.
        </p>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Total cost">
          <Rows
            rows={[
              ['Purchase price', fmtEur(r.costs.price)],
              [`Grunderwerbsteuer (${fmtPct(r.transferTaxRate)})`, fmtEur(r.costs.transferTax)],
              [`Notary + land registry (${fmtPct(a.notaryAndRegistry)})`, fmtEur(r.costs.notary)],
              [`Broker (${fmtPct(r.brokerFeeRate)})`, fmtEur(r.costs.broker)],
              ['Renovation', fmtEur(r.costs.renovation)],
              ['Total', <strong key="t">{fmtEur(r.costs.total)}</strong>],
            ]}
          />
        </Card>
        <Card title="Net operating income (annual)">
          {r.noi ? (
            <Rows
              rows={[
                ['Kaltmiete × 12', fmtEur(r.noi.grossRentAnnual)],
                [`− Vacancy (${fmtPct(a.vacancyRate)})`, fmtEur(-r.noi.vacancy)],
                [`− Non-recoverable Hausgeld (${fmtPct(a.hausgeldNonRecoverableShare, 0)})`, fmtEur(-r.noi.hausgeldNonRecoverable)], // prettier-ignore
                [
                  `− Maintenance (${fmtNum(a.maintenancePerM2PerYear)} €/m²)`,
                  fmtEur(-r.noi.maintenance),
                ],
                ['− Management', fmtEur(-r.noi.management)],
                ['NOI', <strong key="n">{fmtEur(r.noi.total)}</strong>],
              ]}
            />
          ) : (
            <p className="text-sm text-slate-500">Needs a rent.</p>
          )}
        </Card>
      </div>

      <Card title={`What-if (at ${fmtPct(r.whatIf.equityShare, 0)} equity)`}>
        <Rows
          rows={[
            ['Break-even price (cashflow = 0)', fmtEur(r.whatIf.breakEvenPrice)],
            [
              `Price for ${fmtPct(a.targetNetYield)} net yield`,
              fmtEur(r.whatIf.priceForTargetYield),
            ],
            [
              `Kaltmiete for ${fmtPct(a.targetNetYield)} net yield`,
              fmtEur(r.whatIf.requiredRentForTarget, true),
            ],
            ['Kaltmiete for zero cashflow', fmtEur(r.whatIf.requiredRentForZeroCashflow, true)],
          ]}
        />
      </Card>

      <details className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
        <summary className="cursor-pointer font-semibold text-slate-700">Assumptions used</summary>
        <pre className="mt-2 overflow-x-auto text-xs text-slate-600">
          {JSON.stringify(a, null, 2)}
        </pre>
      </details>
    </div>
  );
}
