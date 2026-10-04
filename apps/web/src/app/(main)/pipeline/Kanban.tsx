'use client';

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { fmtEur, fmtPct } from '@immo/calc';
import Link from 'next/link';
import { useState } from 'react';
import type { PropertyRow } from '@/lib/properties';

interface Status {
  id: string;
  name: string;
  color: string;
  kind: string;
}

const VERDICT_DOT = { green: 'bg-green-500', orange: 'bg-amber-500', red: 'bg-red-500', unknown: 'bg-slate-400' }; // prettier-ignore

function Card({ row }: { row: PropertyRow }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: row.id });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={transform ? { transform: `translate(${transform.x}px, ${transform.y}px)` } : undefined}
      className={`cursor-grab rounded-md border border-slate-200 bg-white p-2 text-sm shadow-sm ${isDragging ? 'z-10 opacity-80 shadow-lg' : ''}`}
    >
      <div className="flex items-center gap-1.5">
        <span className={`h-2 w-2 shrink-0 rounded-full ${VERDICT_DOT[row.verdict]}`} />
        <Link
          href={`/properties/${row.id}`}
          className="truncate font-medium hover:underline"
          onPointerDown={(e) => e.stopPropagation()}
        >
          {row.label}
        </Link>
      </div>
      <div className="mt-1 flex justify-between text-xs tabular-nums text-slate-600">
        <span>{fmtEur(row.price)}</span>
        <span>net {fmtPct(row.netYield)}</span>
      </div>
    </div>
  );
}

function Column({ status, rows }: { status: Status; rows: PropertyRow[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: status.id });
  return (
    <section
      ref={setNodeRef}
      className={`flex w-64 shrink-0 flex-col rounded-lg border p-2 ${isOver ? 'border-slate-400 bg-slate-100' : 'border-slate-200 bg-slate-50'}`}
    >
      <header className="mb-2 flex items-center gap-2 px-1 text-sm font-semibold">
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: status.color }} />
        {status.name}
        <span className="ml-auto rounded bg-white px-1.5 text-xs font-normal text-slate-500">
          {rows.length}
        </span>
      </header>
      <div className="flex min-h-24 flex-col gap-2">
        {rows.map((r) => (
          <Card key={r.id} row={r} />
        ))}
      </div>
    </section>
  );
}

export function Kanban({ statuses, rows: initial }: { statuses: Status[]; rows: PropertyRow[] }) {
  const [rows, setRows] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  );

  async function onDragEnd({ active, over }: DragEndEvent) {
    const row = rows.find((r) => r.id === active.id);
    const target = statuses.find((s) => s.id === over?.id);
    if (!row || !target || row.statusId === target.id) return;
    const before = rows;
    const move = (r: PropertyRow): PropertyRow =>
      r.id === row.id
        ? { ...r, statusId: target.id, statusName: target.name, statusColor: target.color }
        : r;
    setRows((rs) => rs.map(move)); // optimistic
    setError(null);
    const res = await fetch(`/api/properties/${row.id}/status`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ statusId: target.id }),
    }).catch(() => null);
    if (!res?.ok) {
      setRows(before);
      setError('Could not change the status — please retry.');
    }
  }

  return (
    <div className="space-y-2">
      {error && <p className="text-sm text-red-700">{error}</p>}
      {rows.length === 0 && (
        <p className="text-sm text-slate-500">
          No properties yet — use “Add to app” in the extension or “Save as property” in the
          calculator. Drag cards between columns to change their status.
        </p>
      )}
      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <div className="flex gap-3 overflow-x-auto pb-4">
          {statuses.map((s) => (
            <Column key={s.id} status={s} rows={rows.filter((r) => r.statusId === s.id)} />
          ))}
        </div>
      </DndContext>
    </div>
  );
}
