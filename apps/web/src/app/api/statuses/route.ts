import { z } from 'zod';
import { guarded, parseBody } from '@/lib/auth';
import { db } from '@/lib/db';

const fields = z.object({
  name: z.string().trim().min(1).max(60),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  kind: z.enum(['open', 'excluded', 'closed']),
});
const patch = fields.partial().extend({ id: z.string().min(1) });

const list = () =>
  db.pipelineStatus.findMany({
    orderBy: { sortOrder: 'asc' },
    include: { _count: { select: { properties: true } } },
  });

export const GET = guarded(async () => Response.json({ statuses: await list() }));

export const POST = guarded(async (req) => {
  const data = await parseBody(req, fields);
  if (data instanceof Response) return data;
  const last = await db.pipelineStatus.findFirst({ orderBy: { sortOrder: 'desc' } });
  try {
    const status = await db.pipelineStatus.create({
      data: { ...data, sortOrder: (last?.sortOrder ?? -1) + 1 },
    });
    return Response.json({ status }, { status: 201 });
  } catch {
    return Response.json({ error: 'name already exists' }, { status: 409 });
  }
});

export const PATCH = guarded(async (req) => {
  const data = await parseBody(req, patch);
  if (data instanceof Response) return data;
  const { id, ...rest } = data;
  try {
    return Response.json({ status: await db.pipelineStatus.update({ where: { id }, data: rest }) });
  } catch {
    return Response.json({ error: 'not found or duplicate name' }, { status: 409 });
  }
});

export const DELETE = guarded(async (req) => {
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return Response.json({ error: 'id required' }, { status: 400 });
  const status = await db.pipelineStatus.findUnique({
    where: { id },
    include: { _count: { select: { properties: true } } },
  });
  if (!status) return Response.json({ error: 'not found' }, { status: 404 });
  if (status._count.properties > 0) {
    return Response.json(
      { error: 'status is in use — move its properties first' },
      { status: 409 },
    );
  }
  if ((await db.pipelineStatus.count()) <= 1) {
    return Response.json({ error: 'at least one status is required' }, { status: 409 });
  }
  await db.pipelineStatus.delete({ where: { id } });
  return new Response(null, { status: 204 });
});
