'use client';

import { fmtEur, fmtPct, type Verdict } from '@immo/calc';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { VerdictPill } from '@/components/AnalysisView';
import { StatusBadge } from '@/components/StatusBadge';
import type { PropertyRow } from '@/lib/properties';

type SortKey = 'label' | 'price' | 'grossYield' | 'netYield' | 'cashflow' | 'verdict' | 'statusName' | 'lastSeenAt'; // prettier-ignore

const COLUMNS: [SortKey, string, boolean][] = [
  ['label', 'Property', false],
  ['price', 'Price', true],
  ['grossYield', 'Gross', true],
  ['netYield', 'Net', true],
  ['cashflow', 'Cashflow/mo', true],
  ['verdict', 'Verdict', false],
  ['statusName', 'Status', false],
  ['lastSeenAt', 'Last seen', false],
];

const VERDICT_ORDER: Record<Verdict, number> = { green: 3, orange: 2, red: 1, unknown: 0 };
const avg = (xs: (number | null)[]) => {
  const v = xs.filter((x): x is number => x != null);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
};
const select = 'rounded border border-slate-300 bg-white px-2 py-1.5 text-sm';

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}

export function Dashboard({
  rows,
  statuses,
  defaultEquity,
}: {
  rows: PropertyRow[];
  statuses: { id: string; name: string }[];
  defaultEquity: number;
}) {
  const [q, setQ] = useState('');
  const [verdict, setVerdict] = useState('');
  const [statusId, setStatusId] = useState('');
  const [city, setCity] = useState('');
  const [source, setSource] = useState('');
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'lastSeenAt', dir: -1 });

  const cities = useMemo(
    () => [...new Set(rows.map((r) => r.city).filter((c): c is string => !!c))].sort(),
    [rows],
  );

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const filtered = rows.filter(
      (r) =>
        (!verdict || r.verdict === verdict) &&
        (!statusId || r.statusId === statusId) &&
        (!city || r.city === city) &&
        (!source || r.source === source) &&
        (!needle || `${r.title ?? ''} ${r.label}`.toLowerCase().includes(needle)),
    );
    const val = (r: PropertyRow) =>
      sort.key === 'verdict' ? VERDICT_ORDER[r.verdict] : r[sort.key];
    return filtered.sort((a, b) => {
      const x = val(a);
      const y = val(b);
      if (x == null) return 1; // nulls last in both directions
      if (y == null) return -1;
      return (x < y ? -1 : x > y ? 1 : 0) * sort.dir;
    });
  }, [rows, q, verdict, statusId, city, source, sort]);

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-600">
        No properties yet. Save a listing with the Chrome extension, or use the{' '}
        <Link href="/calculator" className="underline">
          Calculator
        </Link>{' '}
        and “Save as property”.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tile label="Properties" value={String(shown.length)} />
        <Tile label="Avg gross yield" value={fmtPct(avg(shown.map((r) => r.grossYield)))} />
        <Tile label="Avg net yield" value={fmtPct(avg(shown.map((r) => r.netYield)))} />
        <Tile
          label={`Avg cashflow (${fmtPct(defaultEquity, 0)} equity)`}
          value={fmtEur(avg(shown.map((r) => r.cashflow)))}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search title, city…"
          className={`${select} min-w-48 flex-1`}
        />
        <select
          value={verdict}
          onChange={(e) => setVerdict(e.target.value)}
          className={select}
          aria-label="Verdict"
        >
          <option value="">All verdicts</option>
          <option value="green">Green</option>
          <option value="orange">Orange</option>
          <option value="red">Red</option>
          <option value="unknown">Unknown</option>
        </select>
        <select
          value={statusId}
          onChange={(e) => setStatusId(e.target.value)}
          className={select}
          aria-label="Status"
        >
          <option value="">All statuses</option>
          {statuses.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <select
          value={city}
          onChange={(e) => setCity(e.target.value)}
          className={select}
          aria-label="City"
        >
          <option value="">All cities</option>
          {cities.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <select
          value={source}
          onChange={(e) => setSource(e.target.value)}
          className={select}
          aria-label="Source"
        >
          <option value="">All sources</option>
          <option value="is24">ImmoScout24</option>
          <option value="immowelt">Immowelt</option>
          <option value="manual">Manual</option>
        </select>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              {COLUMNS.map(([key, label, right]) => (
                <th key={key} className={`px-3 py-2 ${right ? 'text-right' : ''}`}>
                  <button
                    onClick={() =>
                      setSort((s) => ({ key, dir: s.key === key ? (-s.dir as 1 | -1) : -1 }))
                    }
                    className="uppercase hover:text-slate-900"
                  >
                    {label}
                    {sort.key === key && (sort.dir === 1 ? ' ▲' : ' ▼')}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="px-3 py-2">
                  <Link href={`/properties/${r.id}`} className="font-medium hover:underline">
                    {r.label}
                  </Link>
                  {r.title && (
                    <div className="max-w-xs truncate text-xs text-slate-500">{r.title}</div>
                  )}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{fmtEur(r.price)}</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {fmtPct(r.grossYield)}
                  {r.placeholderRent && (
                    <span title="Based on placeholder rent data" className="ml-1 text-amber-600">
                      ⚠
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{fmtPct(r.netYield)}</td>
                <td
                  className={`px-3 py-2 text-right tabular-nums ${(r.cashflow ?? 0) < 0 ? 'text-red-700' : ''}`}
                >
                  {fmtEur(r.cashflow)}
                </td>
                <td className="px-3 py-2">
                  <VerdictPill verdict={r.verdict} />
                </td>
                <td className="px-3 py-2">
                  <StatusBadge name={r.statusName} color={r.statusColor} />
                </td>
                <td className="px-3 py-2 text-xs text-slate-500">
                  {new Date(r.lastSeenAt).toLocaleDateString('de-DE')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {shown.length === 0 && (
          <p className="p-6 text-center text-sm text-slate-500">No matches.</p>
        )}
      </div>
    </div>
  );
}
