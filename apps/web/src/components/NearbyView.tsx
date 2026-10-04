'use client';

import { fmtNum } from '@immo/calc';
import { useState, type FormEvent } from 'react';
import type { CategoryResult } from '@/lib/nearby/core';
import type { NearbyResult } from '@/lib/nearby/lookup';

const SHOW = 8;

export const fmtDistance = (m: number) =>
  m < 1000 ? `${Math.max(10, Math.round(m / 10) * 10)} m` : `${fmtNum(m / 1000, 1)} km`;

function CategoryCard({ c }: { c: CategoryResult }) {
  const [all, setAll] = useState(false);
  const shown = all ? c.places : c.places.slice(0, SHOW);
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
      <h3 className="mb-1 flex items-baseline justify-between font-semibold text-slate-800">
        {c.label}
        <span className="text-xs font-normal text-slate-500">
          {c.withinRadius
            ? `${c.places.length} within 2 km`
            : c.places.length
              ? 'nearest'
              : 'none found'}
        </span>
      </h3>
      {c.places.length === 0 && <p className="text-slate-500">Nothing within 30 km.</p>}
      <ul className="space-y-0.5">
        {shown.map((p) => (
          <li key={p.osmUrl} className="flex justify-between gap-2">
            <a
              href={p.osmUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="truncate hover:underline"
            >
              {p.name}
              {p.kind && <span className="ml-1 text-xs text-slate-500">({p.kind})</span>}
            </a>
            <span
              className={`shrink-0 tabular-nums ${c.withinRadius ? 'text-slate-600' : 'rounded bg-amber-100 px-1 text-amber-900'}`}
            >
              {fmtDistance(p.distanceM)}
            </span>
          </li>
        ))}
      </ul>
      {c.places.length > SHOW && (
        <button onClick={() => setAll((x) => !x)} className="mt-1 text-xs text-slate-600 underline">
          {all ? 'Show less' : `Show all ${c.places.length}`}
        </button>
      )}
    </section>
  );
}

export function NearbyView({
  initialAddress,
  initial,
  hint,
}: {
  initialAddress: string;
  initial: NearbyResult | null;
  /** extra warning, e.g. "listing shows no street" */
  hint?: string;
}) {
  const [address, setAddress] = useState(initialAddress);
  const [result, setResult] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(refresh: boolean) {
    if (address.trim().length < 3) return setError('Enter an address (street, PLZ, city).');
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/nearby', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ address, refresh }),
      });
      const j = await res.json();
      if (res.ok) setResult(j.result);
      else setError(j.error ?? 'Lookup failed.');
    } catch {
      setError('Request failed — is the app running?');
    } finally {
      setBusy(false);
    }
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void run(false);
  };

  return (
    <div className="space-y-3">
      <form onSubmit={onSubmit} className="flex flex-wrap gap-2">
        <input
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Straße Nr., PLZ Ort"
          aria-label="Address"
          className="min-w-64 flex-1 rounded border border-slate-300 bg-white px-2 py-1.5 text-sm"
        />
        <button
          disabled={busy}
          className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
        >
          {busy ? 'Searching…' : 'Find nearby'}
        </button>
        {result && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void run(true)}
            className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-50"
          >
            Refresh
          </button>
        )}
      </form>
      {hint && !result && <p className="text-sm text-amber-800">⚠ {hint}</p>}
      {busy && !result && (
        <p className="text-sm text-slate-500">
          Looking up the address and nearby places — this can take 10–60 s (the free OSM servers are
          rate-limited).
        </p>
      )}
      {error && <p className="text-sm text-red-700">{error}</p>}

      {result && (
        <>
          <p className="text-sm text-slate-600">
            📍 {result.displayName}
            <span className="ml-2 text-xs text-slate-400">
              fetched {new Date(result.fetchedAt).toLocaleDateString('de-DE')}
            </span>
          </p>
          {result.precision !== 'exact' && (
            <p className="rounded border border-amber-300 bg-amber-50 p-2 text-sm text-amber-900">
              ⚠ Location is approximate (
              {result.precision === 'street'
                ? 'street without house number'
                : 'only PLZ / city found'}
              ) — distances are measured from{' '}
              {result.precision === 'street' ? 'the street' : 'the centre of the area'}.
            </p>
          )}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {result.categories.map((c) => (
              <CategoryCard key={c.id} c={c} />
            ))}
          </div>
          <p className="text-xs text-slate-500">
            Straight-line distances (Luftlinie). Everything within 2 km is listed; if a category has
            nothing within 2 km, the nearest place is shown (highlighted). Data ©{' '}
            <a
              href="https://www.openstreetmap.org/copyright"
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              OpenStreetMap contributors
            </a>{' '}
            (ODbL) — completeness varies.
          </p>
        </>
      )}
    </div>
  );
}
