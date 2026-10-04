import { createHash, timingSafeEqual } from 'node:crypto';
import { db } from './db';

const digest = (s: string) => createHash('sha256').update(s).digest();

/** SPEC §7.2: same-origin browser requests, or a valid bearer token. */
export async function isAuthorized(req: Request): Promise<boolean> {
  if (req.headers.get('sec-fetch-site') === 'same-origin') return true;
  const m = req.headers.get('authorization')?.match(/^Bearer\s+(\S+)$/i);
  if (!m?.[1]) return false;
  const settings = await db.settings.findUnique({ where: { id: 1 }, select: { apiToken: true } });
  return !!settings && timingSafeEqual(digest(m[1]), digest(settings.apiToken));
}

type Handler<C> = (req: Request, ctx: C) => Promise<Response>;

export function guarded<C>(handler: Handler<C>): Handler<C> {
  return async (req, ctx) =>
    (await isAuthorized(req))
      ? handler(req, ctx)
      : Response.json({ error: 'unauthorized' }, { status: 401 });
}

/** Parse JSON body with a Zod schema; returns a 400 Response on failure. */
export async function parseBody<T>(
  req: Request,
  schema: {
    safeParse(
      x: unknown,
    ): { success: true; data: T } | { success: false; error: { issues: unknown } };
  },
): Promise<T | Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'invalid JSON' }, { status: 400 });
  }
  const r = schema.safeParse(body);
  return r.success
    ? r.data
    : Response.json({ error: 'validation', issues: r.error.issues }, { status: 400 });
}
