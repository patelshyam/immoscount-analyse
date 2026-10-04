import { beforeEach, describe, expect, it, vi } from 'vitest';

// Minimal in-memory stand-in for the Prisma calls upsertListing / status route use.
type Row = Record<string, unknown> & { id: string };
const tables = {
  property: [] as Row[],
  snapshot: [] as Row[],
  statusEvent: [] as Row[],
  status: [] as Row[],
};
let seq = 0;
const id = () => `id${++seq}`;

vi.mock('@/lib/db', () => ({
  db: {
    settings: { findUnique: vi.fn(async () => ({ apiToken: 'tok' })) },
    cityState: {
      findUnique: vi.fn(async ({ where }: { where: { cityKey: string } }) =>
        where.cityKey === 'leipzig' ? { state: 'SN' } : null,
      ),
    },
    pipelineStatus: {
      findFirst: vi.fn(async () => tables.status[0] ?? null),
      findUnique: vi.fn(
        async ({ where }: { where: { id: string } }) =>
          tables.status.find((s) => s.id === where.id) ?? null,
      ),
    },
    property: {
      findUnique: vi.fn(
        async ({
          where,
        }: {
          where: { id?: string; source_externalId?: { source: string; externalId: string } };
        }) =>
          structuredClone(
            tables.property.find((p) =>
              where.id
                ? p.id === where.id
                : p.source === where.source_externalId?.source &&
                  p.externalId === where.source_externalId?.externalId,
            ) ?? null,
          ),
      ),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const { statusEvents, ...rest } = data as { statusEvents: { create: Row } } & Row;
        const row = { lastSeenAt: new Date(0), ...rest, id: id() } as Row;
        tables.property.push(row);
        tables.statusEvent.push({ ...statusEvents.create, propertyId: row.id, id: id() });
        return row;
      }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Row }) => {
        const row = tables.property.find((p) => p.id === where.id)!;
        Object.assign(row, data);
        return row;
      }),
    },
    propertySnapshot: {
      create: vi.fn(async ({ data }: { data: Row }) => {
        tables.snapshot.push({ ...data, id: id() });
        return data;
      }),
    },
    statusEvent: {
      create: vi.fn(async ({ data }: { data: Row }) => {
        tables.statusEvent.push({ ...data, id: id() });
        return data;
      }),
    },
    $transaction: vi.fn(async (ops: Promise<unknown>[]) => Promise.all(ops)),
  },
}));

const { POST } = await import('@/app/api/properties/route');
const status = await import('@/app/api/properties/[id]/status/route');

const LISTING = {
  source: 'is24',
  externalId: '169496867',
  url: 'https://www.immobilienscout24.de/expose/169496867',
  title: 'Gepflegtes Mehrfamilienhaus',
  propertyType: 'multi_family',
  city: 'Leipzig',
  price: 479000,
  livingArea: 300,
  rooms: 10,
  actualColdRentMonthly: 946.85,
  brokerFeeOverride: 0.0595,
};

const post = (body: unknown, headers: Record<string, string> = { authorization: 'Bearer tok' }) =>
  POST(
    new Request('http://127.0.0.1/api/properties', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(body),
    }),
    {} as never,
  );

beforeEach(() => {
  tables.property = [];
  tables.snapshot = [];
  tables.statusEvent = [];
  tables.status = [
    { id: 's-new', name: 'New', sortOrder: 0 },
    { id: 's-view', name: 'Viewing', sortOrder: 1 },
  ];
});

describe('POST /api/properties (upsert)', () => {
  it('401 without token', async () => {
    expect((await post(LISTING, {})).status).toBe(401);
  });

  it('400 on invalid listing', async () => {
    expect((await post({ ...LISTING, price: null })).status).toBe(400);
    expect((await post({ ...LISTING, source: 'ebay' })).status).toBe(400);
  });

  it('creates with first status, state from city, initial snapshot and status event', async () => {
    const res = await post(LISTING);
    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({ created: true, snapshot: true, statusId: 's-new' });
    expect(tables.property[0]).toMatchObject({ state: 'SN', statusId: 's-new' });
    expect(tables.snapshot).toHaveLength(1);
    expect(tables.statusEvent).toEqual([expect.objectContaining({ toStatusId: 's-new' })]);
  });

  it('revisit without changes: updates lastSeenAt, no snapshot', async () => {
    await post(LISTING);
    const res = await post(LISTING);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ created: false, snapshot: false });
    expect(tables.property).toHaveLength(1);
    expect(tables.snapshot).toHaveLength(1);
    expect((tables.property[0]!.lastSeenAt as Date).getTime()).toBeGreaterThan(0);
  });

  it('float noise below DB precision is not a change (2,975 % → 0.029750000000000002)', async () => {
    await post({ ...LISTING, brokerFeeOverride: 0.02975 }); // as stored by Decimal(6,5)
    const res = await post({ ...LISTING, brokerFeeOverride: 2.975 / 100 });
    expect(2.975 / 100).not.toBe(0.02975); // the noise is real
    expect(await res.json()).toMatchObject({ snapshot: false });
    expect(tables.snapshot).toHaveLength(1);
  });

  it('revisit with a changed price records a snapshot', async () => {
    await post(LISTING);
    const res = await post({ ...LISTING, price: 459000 });
    expect(await res.json()).toMatchObject({ snapshot: true });
    expect(tables.snapshot).toHaveLength(2);
    expect(tables.snapshot[1]).toMatchObject({
      fields: expect.objectContaining({ price: 459000 }),
    });
    expect(tables.property[0]!.price).toBe(459000);
  });

  it('revisit never nulls out stored data or touches status/overrides', async () => {
    await post(LISTING);
    Object.assign(tables.property[0]!, {
      statusId: 's-view',
      rentOverrideMonthly: 1200,
      notes: 'mine',
    });
    await post({ ...LISTING, actualColdRentMonthly: null, rooms: null });
    expect(tables.property[0]).toMatchObject({
      actualColdRentMonthly: 946.85,
      rooms: 10,
      statusId: 's-view',
      rentOverrideMonthly: 1200,
      notes: 'mine',
    });
    expect(tables.snapshot).toHaveLength(1);
  });

  it('manual entries always create a new property', async () => {
    await post({ ...LISTING, source: 'manual', externalId: null });
    await post({ ...LISTING, source: 'manual', externalId: null });
    expect(tables.property).toHaveLength(2);
  });
});

describe('POST /api/properties/:id/status', () => {
  const move = (pid: string, body: unknown) =>
    status.POST(
      new Request('http://127.0.0.1/x', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'sec-fetch-site': 'same-origin' },
        body: JSON.stringify(body),
      }),
      { params: Promise.resolve({ id: pid }) },
    );

  it('moves and records history with from/to and note', async () => {
    await post(LISTING);
    const pid = tables.property[0]!.id;
    expect((await move(pid, { statusId: 's-view', note: 'Viewing Friday' })).status).toBe(200);
    expect(tables.property[0]!.statusId).toBe('s-view');
    expect(tables.statusEvent.at(-1)).toMatchObject({
      fromStatusId: 's-new',
      toStatusId: 's-view',
      note: 'Viewing Friday',
    });
  });

  it('same status → no new event; unknown ids → 404', async () => {
    await post(LISTING);
    const pid = tables.property[0]!.id;
    await move(pid, { statusId: 's-new' });
    expect(tables.statusEvent).toHaveLength(1);
    expect((await move(pid, { statusId: 'nope' })).status).toBe(404);
    expect((await move('nope', { statusId: 's-view' })).status).toBe(404);
  });
});
