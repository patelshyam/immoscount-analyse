import { analyze } from '@immo/calc';
import { guarded, parseBody } from '@/lib/auth';
import { db } from '@/lib/db';
import { propertyPatchSchema, toInput } from '@/lib/properties';
import { loadAssumptions, loadReference } from '@/lib/reference';

type Ctx = { params: Promise<{ id: string }> };
const notFound = () => Response.json({ error: 'not found' }, { status: 404 });

export const GET = guarded<Ctx>(async (_req, { params }) => {
  const { id } = await params;
  const p = await db.property.findUnique({ where: { id }, include: { status: true } });
  if (!p) return notFound();
  const analysis = analyze(toInput(p), await loadAssumptions(), await loadReference());
  return Response.json({ property: p, analysis });
});

export const PATCH = guarded<Ctx>(async (req, { params }) => {
  const { id } = await params;
  const data = await parseBody(req, propertyPatchSchema);
  if (data instanceof Response) return data;
  if (!(await db.property.findUnique({ where: { id }, select: { id: true } }))) return notFound();
  return Response.json({ property: await db.property.update({ where: { id }, data }) });
});

export const DELETE = guarded<Ctx>(async (_req, { params }) => {
  const { id } = await params;
  const r = await db.property.deleteMany({ where: { id } });
  return r.count ? new Response(null, { status: 204 }) : notFound();
});
