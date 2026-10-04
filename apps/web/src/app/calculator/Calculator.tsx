'use client';

import { parseGermanNumber, type Analysis } from '@immo/calc';
import { STATE_CODES, STATE_NAMES } from '@immo/data';
import { useState, type FormEvent } from 'react';
import { AnalysisView } from '@/components/AnalysisView';

const num = (v: FormDataEntryValue | null) => parseGermanNumber(String(v ?? ''));
const str = (v: FormDataEntryValue | null) => String(v ?? '').trim() || null;

const input = 'mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm';

function Field({
  label,
  name,
  hint,
  ...rest
}: { label: string; name: string; hint?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block text-sm">
      <span className="text-slate-700">{label}</span>
      <input name={name} className={input} inputMode="decimal" {...rest} />
      {hint && <span className="text-xs text-slate-500">{hint}</span>}
    </label>
  );
}

export function Calculator() {
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const broker = num(f.get('brokerFeePct'));
    const body = {
      city: str(f.get('city')),
      state: str(f.get('state')),
      propertyType: f.get('propertyType'),
      price: num(f.get('price')),
      livingArea: num(f.get('livingArea')),
      rooms: num(f.get('rooms')),
      rentOverrideMonthly: num(f.get('rent')),
      hausgeldMonthly: num(f.get('hausgeld')),
      brokerFeeOverride: broker == null ? null : broker / 100,
      renovationCost: num(f.get('renovation')) ?? 0,
    };
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/calculate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(
          json.issues?.map((i: { path: string[]; message: string }) => `${i.path.join('.')}: ${i.message}`).join('; ') ?? // prettier-ignore
            json.error,
        );
        return;
      }
      setAnalysis(json.analysis);
    } catch {
      setError('Request failed — is the app running?');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      <form
        onSubmit={onSubmit}
        className="space-y-3 rounded-lg border border-slate-200 bg-white p-4"
      >
        <Field label="City" name="city" placeholder="Leipzig" inputMode="text" />
        <label className="block text-sm">
          <span className="text-slate-700">State</span>
          <select name="state" className={input} defaultValue="">
            <option value="">Auto (from city)</option>
            {STATE_CODES.map((s) => (
              <option key={s} value={s}>
                {STATE_NAMES[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-slate-700">Type</span>
          <select name="propertyType" className={input} defaultValue="apartment">
            <option value="apartment">Apartment</option>
            <option value="house">House</option>
            <option value="multi_family">Multi-family</option>
          </select>
        </label>
        <Field label="Kaufpreis (€)" name="price" required placeholder="300.000" />
        <Field label="Wohnfläche (m²)" name="livingArea" required placeholder="75" />
        <Field label="Zimmer" name="rooms" placeholder="3" />
        <Field
          label="Kaltmiete / month (€)"
          name="rent"
          hint="Empty = estimate from rent reference"
        />
        <Field label="Hausgeld / month (€)" name="hausgeld" hint="Apartments only" />
        <Field
          label="Broker fee (%)"
          name="brokerFeePct"
          hint="Empty = default · 0 = provisionsfrei"
        />
        <Field label="Renovation (€)" name="renovation" placeholder="0" />
        <button
          disabled={busy}
          className="w-full rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
        >
          {busy ? 'Calculating…' : 'Analyze'}
        </button>
        {error && <p className="text-sm text-red-700">{error}</p>}
      </form>
      <div>
        {analysis ? (
          <AnalysisView analysis={analysis} />
        ) : (
          <p className="text-sm text-slate-500">Enter a property to see the analysis.</p>
        )}
      </div>
    </div>
  );
}
