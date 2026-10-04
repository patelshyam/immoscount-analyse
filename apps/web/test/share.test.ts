import { beforeEach, describe, expect, it, vi } from 'vitest';

type Link = {
  id: string;
  token: string;
  propertyId: string;
  expiresAt: Date | null;
  revokedAt: Date | null;
  property?: unknown;
};
let links: Link[] = [];

vi.mock('@/lib/db', () => ({
  db: {
    settings: { findUnique: vi.fn(async () => ({ apiToken: 'tok' })) },
    property: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) =>
        where.id === 'p1' ? { id: 'p1' } : null,
      ),
    },
    shareLink: {
      findUnique: vi.fn(async ({ where }: { where: { token?: string; id?: string } }) => {
        const l = links.find((x) => (where.token ? x.token === where.token : x.id === where.id));
        return l ? { ...l, property: { id: l.propertyId } } : null;
      }),
      create: vi.fn(async ({ data }: { data: Omit<Link, 'id' | 'revokedAt'> }) => {
        const l = { ...data, id: `l${links.length + 1}`, revokedAt: null };
        links.push(l);
        return l;
      }),
      updateMany: vi.fn(
        async ({ where, data }: { where: { id: string }; data: { revokedAt: Date } }) => {
          const l = links.find((x) => x.id === where.id && !x.revokedAt);
          if (l) l.revokedAt = data.revokedAt;
          return { count: l ? 1 : 0 };
        },
      ),
    },
  },
}));

const { findActiveShare, newShareToken } = await import('@/lib/share');
const shareRoute = await import('@/app/api/properties/[id]/share/route');
const revokeRoute = await import('@/app/api/share-links/[id]/route');

const T = 'A'.repeat(43);
const auth = { authorization: 'Bearer tok', 'content-type': 'application/json' };

beforeEach(() => {
  links = [];
});

describe('share tokens', () => {
  it('32 random bytes, base64url (43 chars), unique', () => {
    const a = newShareToken();
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(newShareToken()).not.toBe(a);
  });
});

describe('findActiveShare', () => {
  const now = new Date('2026-10-04T12:00:00Z');

  it('active link resolves with its property', async () => {
    links = [{ id: 'l1', token: T, propertyId: 'p1', expiresAt: null, revokedAt: null }];
    expect(await findActiveShare(T, now)).toMatchObject({ id: 'l1', property: { id: 'p1' } });
  });

  it('revoked, expired, unknown and malformed tokens → null', async () => {
    links = [
      { id: 'l1', token: T, propertyId: 'p1', expiresAt: null, revokedAt: new Date('2026-10-01') },
      { id: 'l2', token: 'B'.repeat(43), propertyId: 'p1', expiresAt: new Date('2026-10-04T11:59:59Z'), revokedAt: null }, // prettier-ignore
      {
        id: 'l3',
        token: 'C'.repeat(43),
        propertyId: 'p1',
        expiresAt: new Date('2026-10-05'),
        revokedAt: null,
      },
    ];
    expect(await findActiveShare(T, now)).toBeNull();
    expect(await findActiveShare('B'.repeat(43), now)).toBeNull();
    expect(await findActiveShare('C'.repeat(43), now)).not.toBeNull();
    expect(await findActiveShare('D'.repeat(43), now)).toBeNull();
    expect(await findActiveShare('../../etc', now)).toBeNull();
  });
});

describe('share link API', () => {
  const create = (id: string, body: unknown, headers: Record<string, string> = auth) =>
    shareRoute.POST(
      new Request('http://127.0.0.1/x', { method: 'POST', headers, body: JSON.stringify(body) }),
      { params: Promise.resolve({ id }) },
    );
  const revoke = (id: string) =>
    revokeRoute.DELETE(new Request('http://127.0.0.1/x', { method: 'DELETE', headers: auth }), {
      params: Promise.resolve({ id }),
    });

  it('401 without auth, 404 for unknown property, 400 for bad expiry', async () => {
    expect((await create('p1', {}, { 'content-type': 'application/json' })).status).toBe(401);
    expect((await create('nope', {})).status).toBe(404);
    expect((await create('p1', { expiresInDays: 0 })).status).toBe(400);
  });

  it('creates a link with expiry, then revoke makes it unresolvable (→ 404 page)', async () => {
    const res = await create('p1', { expiresInDays: 7 });
    expect(res.status).toBe(201);
    const { link, path } = await res.json();
    expect(path).toBe(`/share/${link.token}`);
    expect(new Date(link.expiresAt).getTime()).toBeGreaterThan(Date.now() + 6 * 86_400_000);
    expect(await findActiveShare(link.token)).not.toBeNull();

    expect((await revoke(link.id)).status).toBe(204);
    expect(await findActiveShare(link.token)).toBeNull();
    expect((await revoke(link.id)).status).toBe(204); // idempotent
    expect((await revoke('missing')).status).toBe(404);
  });
});
