import { normalizeCityKey } from '@immo/calc';
import { stateCodeSchema } from '@immo/data';
import { z } from 'zod';
import { guarded, parseBody } from '@/lib/auth';
import { db } from '@/lib/db';

const body = z.object({ city: z.string().trim().min(1).max(200), state: stateCodeSchema });

export const GET = guarded(async () =>
  Response.json({ cityState: await db.cityState.findMany({ orderBy: { cityKey: 'asc' } }) }),
);

/** Add or correct a mapping (the extension asks once for unknown cities). */
export const POST = guarded(async (req) => {
  const data = await parseBody(req, body);
  if (data instanceof Response) return data;
  const cityKey = normalizeCityKey(data.city);
  if (!cityKey) return Response.json({ error: 'invalid city' }, { status: 400 });
  const row = await db.cityState.upsert({
    where: { cityKey },
    update: { state: data.state, displayName: data.city },
    create: { cityKey, displayName: data.city, state: data.state },
  });
  return Response.json({ cityState: row });
});
