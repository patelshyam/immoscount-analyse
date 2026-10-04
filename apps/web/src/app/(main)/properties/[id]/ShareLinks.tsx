'use client';

import { useState } from 'react';

interface Link {
  id: string;
  token: string;
  createdAt: string;
  expiresAt: string | null;
  revokedAt: string | null;
}

const date = (s: string) => new Date(s).toLocaleDateString('de-DE');
const status = (l: Link) =>
  l.revokedAt
    ? 'revoked'
    : l.expiresAt && new Date(l.expiresAt) <= new Date()
      ? 'expired'
      : 'active';

export function ShareLinks({ propertyId, initial }: { propertyId: string; initial: Link[] }) {
  const [links, setLinks] = useState(initial);
  const [days, setDays] = useState('30');
  const [note, setNote] = useState('');
  const url = (l: Link) => `${window.location.origin}/share/${l.token}`;

  async function create() {
    const res = await fetch(`/api/properties/${propertyId}/share`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ expiresInDays: days ? Number(days) : null }),
    });
    if (!res.ok) return setNote('Could not create link.');
    const { link } = await res.json();
    setLinks((ls) => [link, ...ls]);
    await navigator.clipboard?.writeText(url(link)).catch(() => {});
    setNote('Link created and copied.');
  }

  async function revoke(l: Link) {
    if (!confirm('Revoke this link? It will stop working immediately.')) return;
    const res = await fetch(`/api/share-links/${l.id}`, { method: 'DELETE' });
    if (res.ok)
      setLinks((ls) =>
        ls.map((x) => (x.id === l.id ? { ...x, revokedAt: new Date().toISOString() } : x)),
      );
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
      <h2 className="mb-2 text-sm font-semibold text-slate-700">Share links (read-only)</h2>
      <p className="mb-2 text-xs text-slate-500">
        Anyone with the link can see the analysis (not your notes or status) — but only while this
        app is reachable from their machine; it runs on localhost.
      </p>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <select
          value={days}
          onChange={(e) => setDays(e.target.value)}
          aria-label="Expiry"
          className="rounded border border-slate-300 bg-white px-2 py-1.5"
        >
          <option value="7">expires in 7 days</option>
          <option value="30">expires in 30 days</option>
          <option value="90">expires in 90 days</option>
          <option value="">never expires</option>
        </select>
        <button
          onClick={create}
          className="rounded bg-slate-900 px-3 py-1.5 font-medium text-white"
        >
          Create link
        </button>
        {note && <span className="text-slate-600">{note}</span>}
      </div>
      {links.length === 0 ? (
        <p className="text-slate-500">No links yet.</p>
      ) : (
        <ul className="space-y-1">
          {links.map((l) => {
            const s = status(l);
            return (
              <li key={l.id} className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded px-1.5 text-xs ${s === 'active' ? 'bg-green-100 text-green-800' : 'bg-slate-200 text-slate-600'}`}
                >
                  {s}
                </span>
                <code
                  className={`truncate text-xs ${s === 'active' ? '' : 'line-through opacity-60'}`}
                >
                  /share/{l.token.slice(0, 10)}…
                </code>
                <span className="text-xs text-slate-500">
                  created {date(l.createdAt)}
                  {l.expiresAt && ` · until ${date(l.expiresAt)}`}
                </span>
                {s === 'active' && (
                  <>
                    <button
                      onClick={() =>
                        navigator.clipboard.writeText(url(l)).then(() => setNote('Copied.'))
                      }
                      className="text-xs underline"
                    >
                      Copy
                    </button>
                    <a
                      href={`/share/${l.token}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs underline"
                    >
                      Open
                    </a>
                    <button onClick={() => revoke(l)} className="text-xs text-red-700 underline">
                      Revoke
                    </button>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
