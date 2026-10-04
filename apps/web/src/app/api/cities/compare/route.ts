import { guarded } from '@/lib/auth';
import { compareCities } from '@/lib/cities';
import { listRows } from '@/lib/properties';
import { loadAssumptions, loadReference } from '@/lib/reference';

export const GET = guarded(async () => {
  const ref = await loadReference();
  const rows = await listRows(await loadAssumptions(), ref);
  return Response.json({ cities: compareCities(rows, ref.rentRefs) });
});
