import { beforeEach, describe, expect, it, vi } from 'vitest';

type Row = Record<string, unknown> & { id: string };
let refs: Row[] = [];
let cityStates: Row[] = [];
let taxUpserts: unknown[] = [];

const rentReference = {
  findMany: vi.fn(async () => refs),
  create: vi.fn(async ({ data }: { data: Row }) => {
    const r = { ...data, id: `r${refs.length + 1}` };
    refs.push(r);
    return r;
  }),
  update: vi.fn(async ({ where, data }: { where: { id: string }; data: Row }) =>
    Object.assign(
      refs.find((r) => r.id === where.id)!,
      data,
    ),
  ),
};
const cityState = {
  upsert: vi.fn(async ({ create }: { create: Row }) => {
    cityStates.push(create);
    return create;
  }),
};

vi.mock('@/lib/db', () => ({
  db: {
    settings: { findUnique: vi.fn(async () => ({ apiToken: 'tok' })) },
    rentReference,
    cityState,
    transferTaxRate: {
      upsert: vi.fn((x: unknown) => {
        taxUpserts.push(x);
        return x;
      }),
      findMany: vi.fn(async () => []),
    },
    $transaction: vi.fn(async (arg: unknown) =>
      typeof arg === 'function' ? arg({ rentReference, cityState }) : Promise.all(arg as unknown[]),
    ),
  },
}));

const importRoute = await import('@/app/api/rent-references/import/route');
const taxRoute = await import('@/app/api/transfer-tax/route');

const HEADER = 'city,state,size_min,size_max,eur_per_m2,source,year,notes';
const csvReq = (
  body: string,
  headers: Record<string, string> = { 'sec-fetch-site': 'same-origin' },
) =>
  new Request('http://127.0.0.1/api/rent-references/import', {
    method: 'POST',
    headers: { 'content-type': 'text/csv', ...headers },
    body,
  });

beforeEach(() => {
  refs = [];
  cityStates = [];
  taxUpserts = [];
});

describe('POST /api/rent-references/import', () => {
  it('401 without auth', async () => {
    expect((await importRoute.POST(csvReq(`${HEADER}\nLeipzig,SN,60,80,9,s,2026,`, {}), {} as never)).status).toBe(401); // prettier-ignore
  });

  it('all-or-nothing: one bad row → 400 with line numbers, nothing saved', async () => {
    const res = await importRoute.POST(
      csvReq(`${HEADER}\nLeipzig,SN,60,80,9,s,2026,\nLeipzig,SN,60,80,abc,s,2026,`),
      {} as never,
    );
    expect(res.status).toBe(400);
    expect((await res.json()).errors).toEqual([expect.objectContaining({ line: 3 })]);
    expect(refs).toEqual([]);
  });

  it('creates new rows, updates same city+band+year, sets city→state', async () => {
    refs = [{ id: 'old', city: 'leipzig', sizeMin: 60, sizeMax: 80, year: 2026, eurPerM2: 5 }];
    const res = await importRoute.POST(
      csvReq(
        `${HEADER}\nLeipzig,SN,60,80,9.1,Mietspiegel,2026,\nLeipzig,SN,80,100,8.5,Mietspiegel,2026,`,
      ),
      {} as never,
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ created: 1, updated: 1 });
    expect(refs.find((r) => r.id === 'old')).toMatchObject({ eurPerM2: 9.1, isPlaceholder: false });
    expect(cityStates[0]).toMatchObject({ cityKey: 'leipzig', state: 'SN' });
  });

  it('empty file → 400', async () => {
    expect((await importRoute.POST(csvReq(`${HEADER}\n`), {} as never)).status).toBe(400);
  });
});

describe('PUT /api/transfer-tax', () => {
  const put = (body: unknown) =>
    taxRoute.PUT(
      new Request('http://127.0.0.1/api/transfer-tax', {
        method: 'PUT',
        headers: { 'content-type': 'application/json', authorization: 'Bearer tok' },
        body: JSON.stringify(body),
      }),
      {} as never,
    );
  const row = {
    state: 'HB',
    rate: 0.055,
    validFrom: '2025-07-01',
    verifiedOn: '2026-10-04',
    source: 'Senat',
  };

  it('rejects rates ≥ 10 %, unknown states and duplicates', async () => {
    expect((await put({ rates: [{ ...row, rate: 0.5 }] })).status).toBe(400);
    expect((await put({ rates: [{ ...row, state: 'XX' }] })).status).toBe(400);
    expect((await put({ rates: [row, row] })).status).toBe(400);
    expect(taxUpserts).toEqual([]);
  });

  it('upserts valid rows', async () => {
    expect((await put({ rates: [row] })).status).toBe(200);
    expect(taxUpserts).toHaveLength(1);
  });
});
