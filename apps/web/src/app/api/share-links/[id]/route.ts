import { guarded } from '@/lib/auth';
import { db } from '@/lib/db';

type Ctx = { params: Promise<{ id: string }> };

/** Revoke (kept for history). Idempotent. */
export const DELETE = guarded<Ctx>(async (_req, { params }) => {
  const { id } = await params;
  const r = await db.shareLink.updateMany({
    where: { id, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  if (!r.count && !(await db.shareLink.findUnique({ where: { id }, select: { id: true } }))) {
    return Response.json({ error: 'not found' }, { status: 404 });
  }
  return new Response(null, { status: 204 });
});
