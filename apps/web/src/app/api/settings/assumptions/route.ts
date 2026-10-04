import { assumptionsSchema } from '@immo/data';
import { guarded, parseBody } from '@/lib/auth';
import { db } from '@/lib/db';
import { loadAssumptions } from '@/lib/reference';

export const GET = guarded(async () => Response.json({ assumptions: await loadAssumptions() }));

export const PUT = guarded(async (req) => {
  const assumptions = await parseBody(req, assumptionsSchema);
  if (assumptions instanceof Response) return assumptions;
  await db.settings.update({ where: { id: 1 }, data: { assumptions } });
  return Response.json({ assumptions });
});
