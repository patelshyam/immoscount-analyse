import { guarded } from '@/lib/auth';
import { db } from '@/lib/db';
import { loadAssumptions, loadReference } from '@/lib/reference';

/** Everything the extension caches (SPEC §6.6). */
export const GET = guarded(async () => {
  const [assumptions, reference, cityState, statuses, saved] = await Promise.all([
    loadAssumptions(),
    loadReference(),
    db.cityState.findMany({ select: { cityKey: true, state: true } }),
    db.pipelineStatus.findMany({
      orderBy: { sortOrder: 'asc' },
      select: { id: true, name: true, color: true, kind: true },
    }),
    db.property.findMany({
      where: { externalId: { not: null }, source: { not: 'manual' } },
      select: { id: true, source: true, externalId: true, statusId: true },
    }),
  ]);
  return Response.json({
    assumptions,
    transferTax: reference.transferTax,
    rentRefs: reference.rentRefs,
    cityState,
    statuses,
    saved,
  });
});
