import { db } from '@/lib/db';
import { listRows } from '@/lib/properties';
import { loadAssumptions, loadReference } from '@/lib/reference';
import { Dashboard } from './Dashboard';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const [assumptions, ref, statuses] = await Promise.all([
    loadAssumptions(),
    loadReference(),
    db.pipelineStatus.findMany({ orderBy: { sortOrder: 'asc' } }),
  ]);
  const rows = await listRows(assumptions, ref);
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <Dashboard
        rows={rows}
        statuses={statuses.map(({ id, name }) => ({ id, name }))}
        defaultEquity={assumptions.defaultEquityShare}
      />
    </div>
  );
}
