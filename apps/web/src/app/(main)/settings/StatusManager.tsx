'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

interface Status {
  id: string;
  name: string;
  color: string;
  kind: 'open' | 'excluded' | 'closed';
  count: number;
}

const cell = 'rounded border border-slate-300 bg-white px-2 py-1 text-sm';

export function StatusManager({ initial }: { initial: Status[] }) {
  const router = useRouter();
  const [statuses, setStatuses] = useState(initial);
  const [error, setError] = useState('');

  async function call(url: string, method: string, body?: unknown) {
    setError('');
    const res = await fetch(url, {
      method,
      headers: body ? { 'content-type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      setError((await res.json().catch(() => ({}))).error ?? 'Request failed.');
      return false;
    }
    router.refresh();
    return true;
  }

  const update = (id: string, patch: Partial<Status>) => {
    setStatuses((ss) => ss.map((s) => (s.id === id ? { ...s, ...patch } : s)));
    void call('/api/statuses', 'PATCH', { id, ...patch });
  };

  async function move(i: number, d: -1 | 1) {
    const next = [...statuses];
    [next[i], next[i + d]] = [next[i + d]!, next[i]!];
    setStatuses(next);
    await call('/api/statuses/reorder', 'POST', { ids: next.map((s) => s.id) });
  }

  async function remove(s: Status) {
    if (!confirm(`Delete status “${s.name}”?`)) return;
    if (await call(`/api/statuses?id=${encodeURIComponent(s.id)}`, 'DELETE')) {
      setStatuses((ss) => ss.filter((x) => x.id !== s.id));
    }
  }

  async function add() {
    const name = prompt('Name of the new status');
    if (!name?.trim()) return;
    const res = await fetch('/api/statuses', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), color: '#64748b', kind: 'open' }),
    });
    const j = await res.json();
    if (!res.ok) return setError(j.error ?? 'Failed.');
    setStatuses((ss) => [...ss, { ...j.status, count: 0 }]);
    router.refresh();
  }

  return (
    <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-4">
      <table className="w-full text-sm">
        <thead className="text-left text-xs uppercase text-slate-500">
          <tr>
            <th className="py-1">Order</th>
            <th className="py-1">Name</th>
            <th className="py-1">Color</th>
            <th className="py-1">Kind</th>
            <th className="py-1">Properties</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {statuses.map((s, i) => (
            <tr key={s.id} className="border-t border-slate-100">
              <td className="py-1.5">
                <button
                  disabled={i === 0}
                  onClick={() => move(i, -1)}
                  className="px-1 disabled:opacity-30"
                  aria-label={`Move ${s.name} up`}
                >
                  ↑
                </button>
                <button
                  disabled={i === statuses.length - 1}
                  onClick={() => move(i, 1)}
                  className="px-1 disabled:opacity-30"
                  aria-label={`Move ${s.name} down`}
                >
                  ↓
                </button>
              </td>
              <td className="py-1.5">
                <input
                  defaultValue={s.name}
                  aria-label="Status name"
                  onBlur={(e) =>
                    e.target.value.trim() &&
                    e.target.value !== s.name &&
                    update(s.id, { name: e.target.value.trim() })
                  }
                  className={cell}
                />
              </td>
              <td className="py-1.5">
                <input
                  type="color"
                  defaultValue={s.color}
                  aria-label="Status color"
                  onBlur={(e) =>
                    e.target.value !== s.color && update(s.id, { color: e.target.value })
                  }
                  className="h-8 w-10"
                />
              </td>
              <td className="py-1.5">
                <select
                  value={s.kind}
                  aria-label="Status kind"
                  onChange={(e) => update(s.id, { kind: e.target.value as Status['kind'] })}
                  className={cell}
                >
                  <option value="open">open</option>
                  <option value="excluded">excluded</option>
                  <option value="closed">closed</option>
                </select>
              </td>
              <td className="py-1.5 tabular-nums text-slate-500">{s.count}</td>
              <td className="py-1.5 text-right">
                <button
                  onClick={() => remove(s)}
                  disabled={s.count > 0}
                  title={s.count > 0 ? 'In use' : 'Delete'}
                  className="text-red-700 disabled:opacity-30"
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex items-center gap-3">
        <button
          onClick={add}
          className="rounded border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
        >
          + Add status
        </button>
        {error && <span className="text-sm text-red-700">{error}</span>}
      </div>
      <p className="text-xs text-slate-500">
        Kind “excluded” marks properties as excluded in the extension&apos;s search badges.
      </p>
    </div>
  );
}
