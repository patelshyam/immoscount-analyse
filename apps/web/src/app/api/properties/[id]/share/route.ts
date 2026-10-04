import { z } from 'zod';
import { guarded, parseBody } from '@/lib/auth';
import { db } from '@/lib/db';
import { newShareToken } from '@/lib/share';

type Ctx = { params: Promise<{ id: string }> };
const body = z.object({ expiresInDays: z.number().int().min(1).max(365).nullable().default(null) });

export const GET = guarded<Ctx>(async (_req, { params }) => {
  const { id } = await params;
  const links = await db.shareLink.findMany({
    where: { propertyId: id },
    orderBy: { createdAt: 'desc' },
  });
  return Response.json({ links });
});

export const POST = guarded<Ctx>(async (req, { params }) => {
  const { id } = await params;
  const data = await parseBody(req, body);
  if (data instanceof Response) return data;
  if (!(await db.property.findUnique({ where: { id }, select: { id: true } }))) {
    return Response.json({ error: 'not found' }, { status: 404 });
  }
  const link = await db.shareLink.create({
    data: {
      propertyId: id,
      token: newShareToken(),
      expiresAt: data.expiresInDays ? new Date(Date.now() + data.expiresInDays * 86_400_000) : null,
    },
  });
  return Response.json({ link, path: `/share/${link.token}` }, { status: 201 });
});
