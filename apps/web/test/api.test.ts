import { DEFAULT_ASSUMPTIONS, TRANSFER_TAX } from '@immo/data';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const TOKEN = 'test-token-123';
const state = { assumptions: DEFAULT_ASSUMPTIONS as unknown, apiToken: TOKEN };

vi.mock('@/lib/db', () => ({
  db: {
    settings: {
      findUnique: vi.fn(async () => ({ ...state })),
      update: vi.fn(async ({ data }: { data: Partial<typeof state> }) => {
        Object.assign(state, data);
        return { ...state };
      }),
    },
    transferTaxRate: {
      findMany: vi.fn(async () =>
        TRANSFER_TAX.map((r) => ({ ...r, validFrom: r.validFrom ? new Date(r.validFrom) : null })),
      ),
    },
    rentReference: { findMany: vi.fn(async () => []) },
    cityState: {
      findUnique: vi.fn(async ({ where }: { where: { cityKey: string } }) =>
        where.cityKey === 'frankfurt am main' ? { cityKey: where.cityKey, state: 'HE' } : null,
      ),
    },
  },
}));

const calculate = await import('@/app/api/calculate/route');
const assumptions = await import('@/app/api/settings/assumptions/route');
const regenerate = await import('@/app/api/settings/token/regenerate/route');

const GOLDEN = {
  price: 300000,
  livingArea: 75,
  rooms: 3,
  city: 'Frankfurt am Main',
  hausgeldMonthly: 300,
  actualColdRentMonthly: 1000,
  brokerFeeOverride: 0.0357,
};

const req = (method: string, headers: Record<string, string>, body?: unknown) =>
  new Request('http://127.0.0.1:3000/api/x', {
    method,
    headers: { 'content-type': 'application/json', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
const sameOrigin = { 'sec-fetch-site': 'same-origin' };
const bearer = { authorization: `Bearer ${TOKEN}` };
const ctx = {} as never;

beforeEach(() => {
  state.assumptions = DEFAULT_ASSUMPTIONS;
  state.apiToken = TOKEN;
});

describe('auth', () => {
  it('401 without token or same-origin', async () => {
    expect((await calculate.POST(req('POST', {}, GOLDEN), ctx)).status).toBe(401);
    expect((await calculate.POST(req('POST', { 'sec-fetch-site': 'cross-site' }, GOLDEN), ctx)).status).toBe(401); // prettier-ignore
  });
  it('401 with a wrong token', async () => {
    expect((await calculate.POST(req('POST', { authorization: 'Bearer nope' }, GOLDEN), ctx)).status).toBe(401); // prettier-ignore
  });
  it('200 same-origin', async () => {
    expect((await calculate.POST(req('POST', sameOrigin, GOLDEN), ctx)).status).toBe(200);
  });
  it('200 with bearer token', async () => {
    expect((await calculate.POST(req('POST', bearer, GOLDEN), ctx)).status).toBe(200);
  });
});

describe('POST /api/calculate', () => {
  it('resolves state from the city and returns the golden analysis', async () => {
    const res = await calculate.POST(req('POST', bearer, GOLDEN), ctx);
    const { analysis } = await res.json();
    expect(analysis.input.state).toBe('HE');
    expect(analysis.costs.total).toBeCloseTo(334710, 2);
    expect(analysis.verdict).toBe('red');
  });
  it('400 on invalid input', async () => {
    const res = await calculate.POST(req('POST', bearer, { ...GOLDEN, price: -1 }), ctx);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('validation');
  });
  it('400 on malformed JSON', async () => {
    const bad = new Request('http://127.0.0.1:3000/api/x', {
      method: 'POST',
      headers: bearer,
      body: '{',
    });
    expect((await calculate.POST(bad, ctx)).status).toBe(400);
  });
});

describe('settings', () => {
  it('PUT assumptions validates and persists', async () => {
    const bad = await assumptions.PUT(req('PUT', sameOrigin, { ...DEFAULT_ASSUMPTIONS, vacancyRate: 3 }), ctx); // prettier-ignore
    expect(bad.status).toBe(400);
    const next = { ...DEFAULT_ASSUMPTIONS, interestRate: 0.041 };
    expect((await assumptions.PUT(req('PUT', sameOrigin, next), ctx)).status).toBe(200);
    const got = await (await assumptions.GET(req('GET', sameOrigin), ctx)).json();
    expect(got.assumptions.interestRate).toBe(0.041);
  });
  it('regenerating the token invalidates the old one', async () => {
    const res = await regenerate.POST(req('POST', sameOrigin), ctx);
    const { apiToken } = await res.json();
    expect(apiToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect((await calculate.POST(req('POST', bearer, GOLDEN), ctx)).status).toBe(401);
    const fresh = { authorization: `Bearer ${apiToken}` };
    expect((await calculate.POST(req('POST', fresh, GOLDEN), ctx)).status).toBe(200);
  });
});
