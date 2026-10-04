import { beforeEach, describe, expect, it, vi } from 'vitest';

const queryRaw = vi.fn();
vi.mock('@/lib/db', () => ({ db: { $queryRaw: queryRaw } }));

const { GET } = await import('@/app/api/health/route');

describe('GET /api/health', () => {
  beforeEach(() => {
    queryRaw.mockReset();
  });

  it('reports ok when the db answers', async () => {
    queryRaw.mockResolvedValue([{ '?column?': 1 }]);
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, db: true });
  });

  it('reports 503 when the db is down', async () => {
    queryRaw.mockImplementation(async () => {
      throw new Error('down');
    });
    const res = await GET();
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ ok: false, db: false });
  });
});
