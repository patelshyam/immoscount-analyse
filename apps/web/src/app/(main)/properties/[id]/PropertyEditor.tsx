'use client';

import { parseGermanNumber, type PropertyType } from '@immo/calc';
import { STATE_CODES, STATE_NAMES } from '@immo/data';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

export interface EditableProperty {
  id: string;
  title: string | null;
  propertyType: PropertyType;
  street: string | null;
  postalCode: string | null;
  city: string | null;
  state: string | null;
  price: number;
  livingArea: number;
  rooms: number | null;
  hausgeldMonthly: number | null;
  actualColdRentMonthly: number | null;
  rentOverrideMonthly: number | null;
  brokerFeeOverride: number | null;
  renovationCost: number;
  yearBuilt: number | null;
  notes: string;
}

const input = 'mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm';
const de = (x: number | null) => (x == null ? '' : String(x).replace('.', ','));

const NUMBER_FIELDS: [keyof EditableProperty, string][] = [
  ['price', 'Kaufpreis (€)'],
  ['livingArea', 'Wohnfläche (m²)'],
  ['rooms', 'Zimmer'],
  ['hausgeldMonthly', 'Hausgeld / month (€)'],
  ['actualColdRentMonthly', 'Actual Kaltmiete / month (€)'],
  ['rentOverrideMonthly', 'Rent override / month (€)'],
  ['renovationCost', 'Renovation (€)'],
  ['yearBuilt', 'Baujahr'],
];

export function PropertyEditor({ property: p }: { property: EditableProperty }) {
  const router = useRouter();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const text = (k: string) => String(f.get(k) ?? '').trim() || null;
    const num = (k: string) => parseGermanNumber(String(f.get(k) ?? ''));
    const broker = num('brokerFeePct');
    const body = {
      title: text('title'),
      propertyType: text('propertyType'),
      street: text('street'),
      postalCode: text('postalCode'),
      city: text('city'),
      state: text('state'),
      ...Object.fromEntries(NUMBER_FIELDS.map(([k]) => [k, num(k)])),
      renovationCost: num('renovationCost') ?? 0,
      brokerFeeOverride: broker == null ? null : broker / 100,
      notes: String(f.get('notes') ?? ''),
    };
    const res = await fetch(`/api/properties/${p.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      setMsg({ ok: true, text: 'Saved.' });
      router.refresh();
    } else {
      const j = await res.json().catch(() => ({}));
      setMsg({
        ok: false,
        text:
          j.issues?.map((i: { path: string[]; message: string }) => `${i.path.join('.')}: ${i.message}`).join('; ') ?? // prettier-ignore
          'Save failed.',
      });
    }
  }

  async function onDelete() {
    if (!confirm('Delete this property and its history?')) return;
    const res = await fetch(`/api/properties/${p.id}`, { method: 'DELETE' });
    if (res.ok) router.push('/');
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-3 rounded-lg border border-slate-200 bg-white p-4 text-sm"
    >
      <label className="block">
        <span className="text-slate-700">Title</span>
        <input name="title" defaultValue={p.title ?? ''} className={input} />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="text-slate-700">City</span>
          <input name="city" defaultValue={p.city ?? ''} className={input} />
        </label>
        <label className="block">
          <span className="text-slate-700">State</span>
          <select name="state" defaultValue={p.state ?? ''} className={input}>
            <option value="">Unknown</option>
            {STATE_CODES.map((s) => (
              <option key={s} value={s}>
                {STATE_NAMES[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-slate-700">PLZ</span>
          <input name="postalCode" defaultValue={p.postalCode ?? ''} className={input} />
        </label>
        <label className="block">
          <span className="text-slate-700">Street</span>
          <input name="street" defaultValue={p.street ?? ''} className={input} />
        </label>
      </div>
      <label className="block">
        <span className="text-slate-700">Type</span>
        <select name="propertyType" defaultValue={p.propertyType} className={input}>
          <option value="apartment">Apartment</option>
          <option value="house">House</option>
          <option value="multi_family">Multi-family</option>
        </select>
      </label>
      <div className="grid grid-cols-2 gap-2">
        {NUMBER_FIELDS.map(([k, label]) => (
          <label key={k} className="block">
            <span className="text-slate-700">{label}</span>
            <input
              name={k}
              defaultValue={de(p[k] as number | null)}
              inputMode="decimal"
              className={input}
            />
          </label>
        ))}
        <label className="block">
          <span className="text-slate-700">Broker fee (%)</span>
          <input
            name="brokerFeePct"
            defaultValue={
              p.brokerFeeOverride == null ? '' : de(Math.round(p.brokerFeeOverride * 1e6) / 1e4)
            }
            placeholder="default"
            inputMode="decimal"
            className={input}
          />
        </label>
      </div>
      <label className="block">
        <span className="text-slate-700">Notes</span>
        <textarea name="notes" defaultValue={p.notes} rows={5} className={input} />
      </label>
      <div className="flex items-center gap-2">
        <button className="rounded bg-slate-900 px-3 py-2 font-medium text-white hover:bg-slate-700">
          Save
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="rounded border border-red-300 px-3 py-2 text-red-700 hover:bg-red-50"
        >
          Delete
        </button>
        {msg && <span className={msg.ok ? 'text-green-700' : 'text-red-700'}>{msg.text}</span>}
      </div>
    </form>
  );
}
