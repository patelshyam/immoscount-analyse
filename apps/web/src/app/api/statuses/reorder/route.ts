import { z } from 'zod';
import { guarded, parseBody } from '@/lib/auth';
import { db } from '@/lib/db';

const body = z.object({ ids: z.array(z.string().min(1)).min(1) });

export const POST = guarded(async (req) => {
  const data = await parseBody(req, body);
  if (data instanceof Response) return data;
  const existing = await db.pipelineStatus.findMany({ select: { id: true } });
  const known = new Set(existing.map((s) => s.id));
  if (data.ids.length !== known.size || !data.ids.every((id) => known.has(id))) {
    return Response.json({ error: 'ids must list every status exactly once' }, { status: 400 });
  }
  await db.$transaction(
    data.ids.map((id, sortOrder) =>
      db.pipelineStatus.update({ where: { id }, data: { sortOrder } }),
    ),
  );
  return Response.json({ ok: true });
});
