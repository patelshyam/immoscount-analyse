'use client';

import { normalizeCityKey } from '@immo/calc';
import { STATE_CODES, STATE_NAMES } from '@immo/data';
import { useMemo, useState, type FormEvent } from 'react';

interface Row {
  cityKey: string;
  displayName: string;
  state: string;
}

const cell = 'rounded border border-slate-300 bg-white px-2 py-1.5 text-sm';

export function CityStateEditor({ initial }: { initial: Row[] }) {
  const [rows, setRows] = useState(initial);
  const [q, setQ] = useState('');
  const [msg, setMsg] = useState('');

  const shown = useMemo(() => {
    const k = normalizeCityKey(q);
    return (k ? rows.filter((r) => r.cityKey.includes(k)) : rows).slice(0, 50);
  }, [rows, q]);

  async function save(city: string, state: string) {
    const res = await fetch('/api/city-state', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ city, state }),
    });
    const j = await res.json();
    if (!res.ok) return setMsg(j.error ?? 'Failed.');
    setRows((rs) => [...rs.filter((r) => r.cityKey !== j.cityState.cityKey), j.cityState]);
    setMsg(`Saved ${j.cityState.displayName} → ${j.cityState.state}.`);
  }

  function onAdd(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const city = String(f.get('city') ?? '').trim();
    if (city) void save(city, String(f.get('state')));
    e.currentTarget.reset();
  }

  return (
    <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
      <p className="text-sm text-slate-600">
        {rows.length} entries (all German cities ≥ 20,000 inhabitants plus your additions). Names
        that exist in two states (e.g. “Frankfurt”, “Halle”, “Senden”) are deliberately missing —
        add the one you mean.
      </p>
      <form onSubmit={onAdd} className="flex flex-wrap gap-2">
        <input name="city" placeholder="City" className={cell} required />
        <select name="state" className={cell} aria-label="State">
          {STATE_CODES.map((s) => (
            <option key={s} value={s}>
              {STATE_NAMES[s]}
            </option>
          ))}
        </select>
        <button className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white">
          Add / update
        </button>
        {msg && <span className="self-center text-sm text-slate-600">{msg}</span>}
      </form>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search…"
        className={`${cell} w-full`}
      />
      <table className="w-full text-sm">
        <tbody>
          {shown.map((r) => (
            <tr key={r.cityKey} className="border-t border-slate-100">
              <td className="py-1">{r.displayName}</td>
              <td className="py-1 text-xs text-slate-400">{r.cityKey}</td>
              <td className="py-1 text-right">
                <select
                  value={r.state}
                  aria-label={`State of ${r.displayName}`}
                  onChange={(e) => save(r.displayName, e.target.value)}
                  className={cell}
                >
                  {STATE_CODES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {shown.length === 50 && (
        <p className="text-xs text-slate-500">Showing the first 50 — refine the search.</p>
      )}
    </div>
  );
}
