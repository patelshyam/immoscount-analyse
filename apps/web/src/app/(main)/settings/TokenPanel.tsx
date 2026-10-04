'use client';

import { useState } from 'react';

export function TokenPanel({ initial }: { initial: string }) {
  const [token, setToken] = useState(initial);
  const [shown, setShown] = useState(false);
  const [note, setNote] = useState('');

  async function regenerate() {
    if (!confirm('Regenerate the token? The extension stops working until you paste the new one.'))
      return;
    const res = await fetch('/api/settings/token/regenerate', { method: 'POST' });
    if (res.ok) {
      setToken((await res.json()).apiToken);
      setShown(true);
      setNote('New token generated.');
    } else setNote('Failed to regenerate.');
  }

  async function copy() {
    await navigator.clipboard.writeText(token);
    setNote('Copied.');
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white p-4">
      <code className="min-w-0 flex-1 truncate rounded bg-slate-100 px-2 py-1.5 text-sm">
        {shown ? token : '•'.repeat(32)}
      </code>
      <button
        onClick={() => setShown((s) => !s)}
        className="rounded border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
      >
        {shown ? 'Hide' : 'Show'}
      </button>
      <button
        onClick={copy}
        className="rounded border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
      >
        Copy
      </button>
      <button
        onClick={regenerate}
        className="rounded border border-red-300 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50"
      >
        Regenerate
      </button>
      {note && <span className="text-sm text-slate-600">{note}</span>}
    </div>
  );
}
