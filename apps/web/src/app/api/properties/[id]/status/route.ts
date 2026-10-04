import { z } from 'zod';
import { guarded, parseBody } from '@/lib/auth';
import { db } from '@/lib/db';

type Ctx = { params: Promise<{ id: string }> };
const body = z.object({
  statusId: z.string().min(1),
  note: z.string().max(2000).nullable().optional(),
});

export const POST = guarded<Ctx>(async (req, { params }) => {
  const { id } = await params;
  const data = await parseBody(req, body);
  if (data instanceof Response) return data;
  const [property, status] = await Promise.all([
    db.property.findUnique({ where: { id }, select: { statusId: true } }),
    db.pipelineStatus.findUnique({ where: { id: data.statusId } }),
  ]);
  if (!property || !status) return Response.json({ error: 'not found' }, { status: 404 });
  if (property.statusId === data.statusId) return Response.json({ statusId: data.statusId });
  await db.$transaction([
    db.property.update({ where: { id }, data: { statusId: data.statusId } }),
    db.statusEvent.create({
      data: {
        propertyId: id,
        fromStatusId: property.statusId,
        toStatusId: data.statusId,
        note: data.note ?? null,
      },
    }),
  ]);
  return Response.json({ statusId: data.statusId });
});
