'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

export function StatusChanger({
  propertyId,
  statusId,
  statuses,
}: {
  propertyId: string;
  statusId: string;
  statuses: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [target, setTarget] = useState(statusId);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const res = await fetch(`/api/properties/${propertyId}/status`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ statusId: target, note: note.trim() || null }),
    });
    if (!res.ok) return setError('Failed to change status.');
    setNote('');
    setError('');
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-wrap items-center gap-2 text-sm">
      <select
        value={target}
        onChange={(e) => setTarget(e.target.value)}
        aria-label="Status"
        className="rounded border border-slate-300 bg-white px-2 py-1.5"
      >
        {statuses.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Note (optional)"
        className="w-48 rounded border border-slate-300 px-2 py-1.5"
      />
      <button
        disabled={target === statusId}
        className="rounded bg-slate-900 px-3 py-1.5 font-medium text-white disabled:opacity-40"
      >
        Change status
      </button>
      {error && <span className="text-red-700">{error}</span>}
    </form>
  );
}
