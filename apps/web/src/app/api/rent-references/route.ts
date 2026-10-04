import { rentReferenceSchema } from '@immo/data';
import { z } from 'zod';
import { guarded, parseBody } from '@/lib/auth';
import { db } from '@/lib/db';
import { rentRefDto } from '@/lib/rent-refs';

const list = async () =>
  (await db.rentReference.findMany({ orderBy: [{ city: 'asc' }, { year: 'desc' }, { sizeMin: 'asc' }] })).map(rentRefDto); // prettier-ignore

export const GET = guarded(async () => Response.json({ rentReferences: await list() }));

export const POST = guarded(async (req) => {
  const data = await parseBody(req, rentReferenceSchema);
  if (data instanceof Response) return data;
  return Response.json(
    { rentReference: rentRefDto(await db.rentReference.create({ data })) },
    { status: 201 },
  );
});

const patchSchema = z.object({ id: z.string().min(1), row: rentReferenceSchema });

export const PATCH = guarded(async (req) => {
  const data = await parseBody(req, patchSchema);
  if (data instanceof Response) return data;
  const r = await db.rentReference.updateMany({ where: { id: data.id }, data: data.row });
  if (!r.count) return Response.json({ error: 'not found' }, { status: 404 });
  return Response.json({
    rentReference: rentRefDto((await db.rentReference.findUnique({ where: { id: data.id } }))!),
  });
});

/** `?id=…` deletes one row; `?placeholders=true` deletes all demo/placeholder rows. */
export const DELETE = guarded(async (req) => {
  const p = new URL(req.url).searchParams;
  if (p.get('placeholders') === 'true') {
    const r = await db.rentReference.deleteMany({ where: { isPlaceholder: true } });
    return Response.json({ deleted: r.count });
  }
  const id = p.get('id');
  if (!id) return Response.json({ error: 'id or placeholders=true required' }, { status: 400 });
  const r = await db.rentReference.deleteMany({ where: { id } });
  return r.count
    ? new Response(null, { status: 204 })
    : Response.json({ error: 'not found' }, { status: 404 });
});
