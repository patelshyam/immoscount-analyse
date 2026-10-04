'use client';

import { parseGermanNumber, type Assumptions } from '@immo/calc';
import { DEFAULT_ASSUMPTIONS } from '@immo/data';
import { useState, type FormEvent } from 'react';

type Key = Exclude<keyof Assumptions, 'equityScenarios'>;
const FIELDS: { key: Key; label: string; unit: '%' | '€/m²/yr' | '€/month' | 'years' }[] = [
  { key: 'targetNetYield', label: 'Target net yield', unit: '%' },
  { key: 'orangeBand', label: 'Orange band below target', unit: '%' },
  { key: 'notaryAndRegistry', label: 'Notary + land registry', unit: '%' },
  { key: 'brokerFee', label: 'Broker fee (incl. VAT)', unit: '%' },
  { key: 'maintenancePerM2PerYear', label: 'Maintenance reserve', unit: '€/m²/yr' },
  { key: 'vacancyRate', label: 'Vacancy', unit: '%' },
  { key: 'hausgeldNonRecoverableShare', label: 'Non-recoverable Hausgeld share', unit: '%' },
  { key: 'managementMonthly', label: 'Sondereigentumsverwaltung', unit: '€/month' },
  { key: 'interestRate', label: 'Interest rate', unit: '%' },
  { key: 'initialRepayment', label: 'Anfängliche Tilgung', unit: '%' },
  { key: 'fixedRateYears', label: 'Zinsbindung', unit: 'years' },
  { key: 'defaultEquityShare', label: 'Default equity (badges, break-even)', unit: '%' },
];

// Display in percent, store as fractions; round away float noise (0.035*100 = 3.5000000000000004).
const toPct = (x: number) => String(Math.round(x * 1e6) / 1e4).replace('.', ',');
const fromPct = (s: string) => {
  const n = parseGermanNumber(s);
  return n == null ? NaN : Math.round(n * 1e4) / 1e6;
};

const display = (a: Assumptions, k: Key) =>
  FIELDS.find((f) => f.key === k)?.unit === '%' ? toPct(a[k]) : String(a[k]).replace('.', ',');

export function AssumptionsForm({ initial }: { initial: Assumptions }) {
  const [values, setValues] = useState(initial);
  const [formKey, setFormKey] = useState(0);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function save(a: Assumptions) {
    setMsg(null);
    const res = await fetch('/api/settings/assumptions', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(a),
    });
    const json = await res.json();
    if (res.ok) {
      setValues(json.assumptions);
      setFormKey((k) => k + 1);
      setMsg({ ok: true, text: 'Saved.' });
    } else {
      setMsg({
        ok: false,
        text:
          json.issues?.map((i: { path: string[]; message: string }) => `${i.path.join('.')}: ${i.message}`).join('; ') ?? json.error, // prettier-ignore
      });
    }
  }

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const next = { ...values };
    for (const { key, unit } of FIELDS) {
      const raw = String(f.get(key) ?? '');
      next[key] = unit === '%' ? fromPct(raw) : (parseGermanNumber(raw) ?? NaN);
    }
    next.equityScenarios = String(f.get('equityScenarios') ?? '')
      .split(/[;\s]+/)
      .filter(Boolean)
      .map(fromPct);
    void save(next);
  }

  return (
    <form
      key={formKey}
      onSubmit={onSubmit}
      className="space-y-4 rounded-lg border border-slate-200 bg-white p-4"
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {FIELDS.map(({ key, label, unit }) => (
          <label key={key} className="block text-sm">
            <span className="text-slate-700">{label}</span>
            <span className="mt-1 flex items-center gap-2">
              <input
                name={key}
                defaultValue={display(values, key)}
                inputMode="decimal"
                className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm tabular-nums"
              />
              <span className="w-20 shrink-0 text-xs text-slate-500">{unit}</span>
            </span>
          </label>
        ))}
        <label className="block text-sm">
          <span className="text-slate-700">Equity scenarios</span>
          <span className="mt-1 flex items-center gap-2">
            <input
              name="equityScenarios"
              defaultValue={values.equityScenarios.map(toPct).join('; ')}
              className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm tabular-nums"
            />
            <span className="w-20 shrink-0 text-xs text-slate-500">% ; separated</span>
          </span>
        </label>
      </div>
      <div className="flex items-center gap-3">
        <button className="rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700">
          Save assumptions
        </button>
        <button
          type="button"
          onClick={() =>
            confirm('Reset all assumptions to the defaults?') && void save(DEFAULT_ASSUMPTIONS)
          }
          className="rounded border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50"
        >
          Reset to defaults
        </button>
        {msg && (
          <span className={`text-sm ${msg.ok ? 'text-green-700' : 'text-red-700'}`}>
            {msg.text}
          </span>
        )}
      </div>
    </form>
  );
}
