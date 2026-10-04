import { guarded } from '@/lib/auth';
import { db } from '@/lib/db';

export const GET = guarded(async (req) => {
  const p = new URL(req.url).searchParams;
  const source = p.get('source');
  const externalId = p.get('externalId');
  if ((source !== 'is24' && source !== 'immowelt') || !externalId) {
    return Response.json({ error: 'source and externalId required' }, { status: 400 });
  }
  const found = await db.property.findUnique({
    where: { source_externalId: { source, externalId } },
    select: { id: true, statusId: true },
  });
  return found ? Response.json(found) : Response.json({ error: 'not found' }, { status: 404 });
});
