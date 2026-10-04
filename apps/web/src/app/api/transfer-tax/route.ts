import { transferTaxRowSchema } from '@immo/data';
import { z } from 'zod';
import { guarded, parseBody } from '@/lib/auth';
import { db } from '@/lib/db';

const iso = (d: Date | null) => d?.toISOString().slice(0, 10) ?? null;
const list = async () =>
  (await db.transferTaxRate.findMany({ orderBy: { state: 'asc' } })).map((r) => ({
    state: r.state,
    rate: Number(r.rate),
    validFrom: iso(r.validFrom),
    verifiedOn: iso(r.verifiedOn),
    source: r.source,
  }));

export const GET = guarded(async () => Response.json({ rates: await list() }));

/** Replace rows for the given states (one row per state, SPEC §7.3). */
export const PUT = guarded(async (req) => {
  const body = await parseBody(
    req,
    z.object({ rates: z.array(transferTaxRowSchema).min(1).max(16) }),
  );
  if (body instanceof Response) return body;
  if (new Set(body.rates.map((r) => r.state)).size !== body.rates.length) {
    return Response.json({ error: 'each state at most once' }, { status: 400 });
  }
  await db.$transaction(
    body.rates.map((r) => {
      const data = {
        rate: r.rate,
        validFrom: r.validFrom ? new Date(r.validFrom) : null,
        verifiedOn: r.verifiedOn ? new Date(r.verifiedOn) : null,
        source: r.source,
      };
      return db.transferTaxRate.upsert({
        where: { state: r.state },
        update: data,
        create: { state: r.state, ...data },
      });
    }),
  );
  return Response.json({ rates: await list() });
});
