'use client';

import { parseGermanNumber } from '@immo/calc';
import { STATE_NAMES } from '@immo/data';
import { useState } from 'react';

interface Row {
  state: string;
  rate: number;
  validFrom: string | null;
  verifiedOn: string | null;
  source: string | null;
}

const cell = 'w-full rounded border border-slate-300 px-2 py-1 text-sm';
const pct = (x: number) => String(Math.round(x * 1e6) / 1e4).replace('.', ',');

export function TransferTaxEditor({ initial }: { initial: Row[] }) {
  const [rows, setRows] = useState(initial);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const set = (i: number, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  async function save() {
    const res = await fetch('/api/transfer-tax', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ rates: rows }),
    });
    const j = await res.json();
    if (res.ok) {
      setRows(j.rates);
      setMsg({ ok: true, text: 'Saved.' });
    } else {
      setMsg({
        ok: false,
        text: j.issues?.map((x: { path: (string | number)[]; message: string }) => `${rows[Number(x.path[1])]?.state ?? ''} ${x.path.at(-1)}: ${x.message}`).join('; ') ?? j.error, // prettier-ignore
      });
    }
  }

  return (
    <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-4">
      <table className="w-full text-sm">
        <thead className="text-left text-xs uppercase text-slate-500">
          <tr>
            <th className="py-1">State</th>
            <th className="py-1">Rate %</th>
            <th className="py-1">Valid from</th>
            <th className="py-1">Verified on</th>
            <th className="py-1">Source</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.state} className="border-t border-slate-100">
              <td className="py-1 pr-2">
                {STATE_NAMES[r.state as keyof typeof STATE_NAMES] ?? r.state}{' '}
                <span className="text-xs text-slate-400">{r.state}</span>
              </td>
              <td className="w-24 py-1 pr-2">
                <input
                  aria-label={`${r.state} rate`}
                  defaultValue={pct(r.rate)}
                  inputMode="decimal"
                  onChange={(e) =>
                    set(i, { rate: (parseGermanNumber(e.target.value) ?? NaN) / 100 })
                  }
                  className={cell}
                />
              </td>
              <td className="w-40 py-1 pr-2">
                <input
                  type="date"
                  value={r.validFrom ?? ''}
                  onChange={(e) => set(i, { validFrom: e.target.value || null })}
                  className={cell}
                />
              </td>
              <td className="w-40 py-1 pr-2">
                <input
                  type="date"
                  value={r.verifiedOn ?? ''}
                  onChange={(e) => set(i, { verifiedOn: e.target.value || null })}
                  className={cell}
                />
              </td>
              <td className="py-1">
                <input
                  value={r.source ?? ''}
                  onChange={(e) => set(i, { source: e.target.value || null })}
                  className={cell}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex items-center gap-3">
        <button
          onClick={save}
          className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700"
        >
          Save rates
        </button>
        {msg && (
          <span className={`text-sm ${msg.ok ? 'text-green-700' : 'text-red-700'}`}>
            {msg.text}
          </span>
        )}
      </div>
    </div>
  );
}
