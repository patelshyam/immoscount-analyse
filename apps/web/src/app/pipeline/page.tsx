import type { Metadata } from 'next';
import { db } from '@/lib/db';
import { listRows } from '@/lib/properties';
import { loadAssumptions, loadReference } from '@/lib/reference';
import { Kanban } from './Kanban';

export const metadata: Metadata = { title: 'Pipeline · immo-analyzer' };
export const dynamic = 'force-dynamic';

export default async function PipelinePage() {
  const [assumptions, ref, statuses] = await Promise.all([
    loadAssumptions(),
    loadReference(),
    db.pipelineStatus.findMany({ orderBy: { sortOrder: 'asc' } }),
  ]);
  const rows = await listRows(assumptions, ref);
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Pipeline</h1>
      <Kanban
        statuses={statuses.map(({ id, name, color, kind }) => ({ id, name, color, kind }))}
        rows={rows}
      />
    </div>
  );
}
