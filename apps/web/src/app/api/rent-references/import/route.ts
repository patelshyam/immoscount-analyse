import { parseRentCsv } from '@immo/data';
import { guarded } from '@/lib/auth';
import { importRentRows } from '@/lib/rent-refs';

const MAX_BYTES = 2_000_000;

/** Body: the CSV text (content-type text/csv). All-or-nothing: any bad row → 400, nothing saved. */
export const POST = guarded(async (req) => {
  const text = await req.text();
  if (text.length > MAX_BYTES) return Response.json({ error: 'file too large' }, { status: 413 });
  const { rows, errors } = parseRentCsv(text);
  if (errors.length) return Response.json({ error: 'validation', errors }, { status: 400 });
  if (!rows.length) return Response.json({ error: 'no rows' }, { status: 400 });
  return Response.json(await importRentRows(rows));
});
