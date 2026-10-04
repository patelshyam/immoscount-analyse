import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  let ok = true;
  try {
    await db.$queryRaw`SELECT 1`;
  } catch {
    ok = false;
  }
  return Response.json({ ok, db: ok }, { status: ok ? 200 : 503 });
}
