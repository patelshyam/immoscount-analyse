import { guarded } from '@/lib/auth';
import { db } from '@/lib/db';
import { newToken } from '@/lib/seed';

export const POST = guarded(async () => {
  const { apiToken } = await db.settings.update({
    where: { id: 1 },
    data: { apiToken: newToken() },
  });
  return Response.json({ apiToken });
});
