import { randomBytes } from 'node:crypto';
import { db } from './db';

export const newShareToken = () => randomBytes(32).toString('base64url');

const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;

/** The share link + property if the token exists, is not revoked and not expired; else null. */
export async function findActiveShare(token: string, now = new Date()) {
  if (!TOKEN_RE.test(token)) return null;
  const link = await db.shareLink.findUnique({ where: { token }, include: { property: true } });
  if (!link || link.revokedAt || (link.expiresAt && link.expiresAt <= now)) return null;
  return link;
}
