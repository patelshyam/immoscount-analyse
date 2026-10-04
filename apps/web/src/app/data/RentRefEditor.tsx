'use client';

import { parseGermanNumber } from '@immo/calc';
import { RENT_CSV_COLUMNS } from '@immo/data';
import { useState, type ChangeEvent, type FormEvent } from 'react';

interface Ref {
  id: string;
  city: string;
  sizeMin: number;
  sizeMax: number | null;
  eurPerM2: number;
  source: string;
  year: number;
  isPlaceholder: boolean;
  notes: string | null;
}

const GRID = 'grid grid-cols-[1.5fr_.6fr_.6fr_.7fr_1.5fr_.6fr_1.2fr_auto] items-center gap-1.5';
const cell = 'w-full rounded border border-slate-300 bg-white px-2 py-1 text-sm';
const de = (x: number | null) => (x == null ? '' : String(x).replace('.', ','));
const TEMPLATE = `data:text/csv;charset=utf-8,${encodeURIComponent(RENT_CSV_COLUMNS.join(',') + '\n')}`;

type Issue = { path: (string | number)[]; message: string };
const issueText = (j: { issues?: Issue[]; error?: string }) =>
  j.issues?.map((x) => `${x.path.join('.')}: ${x.message}`).join('; ') ?? j.error ?? 'Failed.';

function rowFrom(form: HTMLFormElement) {
  const f = new FormData(form);
  const s = (k: string) => String(f.get(k) ?? '').trim();
  return {
    city: s('city'),
    sizeMin: parseGermanNumber(s('sizeMin')) ?? 0,
    sizeMax: parseGermanNumber(s('sizeMax')),
    eurPerM2: parseGermanNumber(s('eurPerM2')),
    source: s('source'),
    year: parseGermanNumber(s('year')),
    isPlaceholder: false, // anything you enter or edit is real data
    notes: s('notes') || null,
  };
}

function Fields({ r }: { r?: Ref }) {
  return (
    <>
      <input
        name="city"
        defaultValue={r?.city}
        placeholder="City"
        aria-label="City"
        className={cell}
        required
      />
      <input
        name="sizeMin"
        defaultValue={de(r?.sizeMin ?? null)}
        placeholder="m² from"
        aria-label="Size from (m²)"
        className={cell}
      />
      <input
        name="sizeMax"
        defaultValue={de(r?.sizeMax ?? null)}
        placeholder="to (open)"
        aria-label="Size to (m²)"
        className={cell}
      />
      <input
        name="eurPerM2"
        defaultValue={de(r?.eurPerM2 ?? null)}
        placeholder="€/m²"
        aria-label="€ per m²"
        className={cell}
        required
      />
      <input
        name="source"
        defaultValue={r?.source}
        placeholder="Source"
        aria-label="Source"
        className={cell}
        required
      />
      <input
        name="year"
        defaultValue={r?.year}
        placeholder="Year"
        aria-label="Year"
        className={cell}
        required
      />
      <input
        name="notes"
        defaultValue={r?.notes ?? ''}
        placeholder="Notes"
        aria-label="Notes"
        className={cell}
      />
    </>
  );
}

export function RentRefEditor({ initial }: { initial: Ref[] }) {
  const [rows, setRows] = useState(initial);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [importErrors, setImportErrors] = useState<{ line: number; message: string }[]>([]);
  const placeholders = rows.filter((r) => r.isPlaceholder).length;

  async function reload() {
    const j = await (await fetch('/api/rent-references')).json();
    setRows(j.rentReferences);
  }

  async function add(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const res = await fetch('/api/rent-references', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(rowFrom(form)),
    });
    const j = await res.json();
    if (!res.ok) return setMsg({ ok: false, text: issueText(j) });
    form.reset();
    setMsg({ ok: true, text: 'Added.' });
    await reload();
  }

  async function update(e: FormEvent<HTMLFormElement>, id: string) {
    e.preventDefault();
    const res = await fetch('/api/rent-references', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id, row: rowFrom(e.currentTarget) }),
    });
    const j = await res.json();
    if (!res.ok) return setMsg({ ok: false, text: issueText(j) });
    setRows((rs) => rs.map((r) => (r.id === id ? j.rentReference : r)));
    setMsg({ ok: true, text: 'Saved.' });
  }

  async function remove(id: string) {
    await fetch(`/api/rent-references?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    setRows((rs) => rs.filter((r) => r.id !== id));
  }

  async function removePlaceholders() {
    if (!confirm(`Delete all ${placeholders} placeholder rows?`)) return;
    await fetch('/api/rent-references?placeholders=true', { method: 'DELETE' });
    await reload();
  }

  async function importCsv(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setImportErrors([]);
    const res = await fetch('/api/rent-references/import', {
      method: 'POST',
      headers: { 'content-type': 'text/csv' },
      body: await file.text(),
    });
    const j = await res.json();
    if (!res.ok) {
      setImportErrors(j.errors ?? []);
      return setMsg({
        ok: false,
        text: `Import failed — nothing was saved. ${j.errors ? '' : (j.error ?? '')}`,
      });
    }
    setMsg({ ok: true, text: `Imported: ${j.created} new, ${j.updated} updated.` });
    await reload();
  }

  return (
    <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <label className="cursor-pointer rounded bg-slate-900 px-3 py-1.5 font-medium text-white hover:bg-slate-700">
          Import CSV…
          <input type="file" accept=".csv,text/csv" onChange={importCsv} className="hidden" />
        </label>
        <a
          href="/api/rent-references/export"
          className="rounded border border-slate-300 px-3 py-1.5 hover:bg-slate-50"
        >
          Export CSV
        </a>
        <a
          href={TEMPLATE}
          download="rent-reference.template.csv"
          className="rounded border border-slate-300 px-3 py-1.5 hover:bg-slate-50"
        >
          Template
        </a>
        {placeholders > 0 && (
          <button
            onClick={removePlaceholders}
            className="rounded border border-amber-400 px-3 py-1.5 text-amber-900 hover:bg-amber-50"
          >
            Delete {placeholders} placeholder rows
          </button>
        )}
        {msg && <span className={msg.ok ? 'text-green-700' : 'text-red-700'}>{msg.text}</span>}
      </div>
      <p className="text-xs text-slate-500">
        CSV columns: <code>{RENT_CSV_COLUMNS.join(',')}</code> (optional <code>is_placeholder</code>
        ). Size bands: min inclusive, max exclusive, empty max = open band. Decimals as 8.5 or
        &quot;8,5&quot;. Rows with the same city, band and year are updated; a state sets the
        city→state mapping.
      </p>
      {importErrors.length > 0 && (
        <ul className="max-h-40 overflow-y-auto rounded border border-red-200 bg-red-50 p-2 text-xs text-red-800">
          {importErrors.map((e) => (
            <li key={`${e.line}-${e.message}`}>
              Line {e.line}: {e.message}
            </li>
          ))}
        </ul>
      )}

      <div className={`${GRID} text-xs uppercase text-slate-500`}>
        <span>City</span>
        <span>m² from</span>
        <span>m² to</span>
        <span>€/m²</span>
        <span>Source</span>
        <span>Year</span>
        <span>Notes</span>
        <span />
      </div>
      <form onSubmit={add} className={`${GRID} border-b border-slate-200 pb-3`}>
        <Fields />
        <button className="rounded border border-slate-300 px-2 py-1 text-sm hover:bg-slate-50">
          Add
        </button>
      </form>
      {rows.length === 0 && <p className="text-sm text-slate-500">No rent references yet.</p>}
      {rows.map((r) => (
        <form
          key={`${r.id}-${r.eurPerM2}-${r.year}`}
          onSubmit={(e) => update(e, r.id)}
          className={`${GRID} rounded ${r.isPlaceholder ? 'border-l-4 border-amber-400 bg-amber-50 pl-1' : ''}`}
          title={r.isPlaceholder ? 'Placeholder demo row — not real market data' : undefined}
        >
          <Fields r={r} />
          <span className="flex gap-1">
            <button className="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50">
              Save
            </button>
            <button
              type="button"
              onClick={() => remove(r.id)}
              className="rounded border border-red-300 px-2 py-1 text-xs text-red-700 hover:bg-red-50"
            >
              ✕
            </button>
          </span>
        </form>
      ))}
    </div>
  );
}
