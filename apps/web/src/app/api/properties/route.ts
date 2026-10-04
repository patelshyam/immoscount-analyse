import { z } from 'zod';
import { guarded, parseBody } from '@/lib/auth';
import { listingSchema, listRows, upsertListing, type PropertyRow } from '@/lib/properties';
import { loadAssumptions, loadReference } from '@/lib/reference';

const SORT_KEYS = ['price', 'grossYield', 'netYield', 'cashflow', 'lastSeenAt', 'city'] as const;
const querySchema = z.object({
  verdict: z.enum(['green', 'orange', 'red', 'unknown']).optional(),
  statusId: z.string().optional(),
  city: z.string().optional(),
  source: z.enum(['is24', 'immowelt', 'manual']).optional(),
  q: z.string().optional(),
  sort: z.enum(SORT_KEYS).default('lastSeenAt'),
  dir: z.enum(['asc', 'desc']).default('desc'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(500).default(50),
});

export const GET = guarded(async (req) => {
  const parsed = querySchema.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!parsed.success) {
    return Response.json({ error: 'validation', issues: parsed.error.issues }, { status: 400 });
  }
  const f = parsed.data;
  const q = f.q?.toLowerCase();
  const rows = (await listRows(await loadAssumptions(), await loadReference())).filter(
    (r) =>
      (!f.verdict || r.verdict === f.verdict) &&
      (!f.statusId || r.statusId === f.statusId) &&
      (!f.city || r.city?.toLowerCase() === f.city.toLowerCase()) &&
      (!f.source || r.source === f.source) &&
      (!q || `${r.title} ${r.label}`.toLowerCase().includes(q)),
  );
  const key = f.sort as keyof PropertyRow;
  rows.sort((a, b) => {
    const x = a[key] ?? -Infinity;
    const y = b[key] ?? -Infinity;
    return (x < y ? -1 : x > y ? 1 : 0) * (f.dir === 'asc' ? 1 : -1);
  });
  const start = (f.page - 1) * f.pageSize;
  return Response.json({ total: rows.length, items: rows.slice(start, start + f.pageSize) });
});

export const POST = guarded(async (req) => {
  const data = await parseBody(req, listingSchema);
  if (data instanceof Response) return data;
  const r = await upsertListing(data);
  return Response.json(
    { id: r.property.id, statusId: r.property.statusId, created: r.created, snapshot: r.snapshot },
    { status: r.created ? 201 : 200 },
  );
});
