import { normalizeCityKey, type StateCode } from '@immo/calc';
import { rentRowsToCsv } from '@immo/data';
import { guarded } from '@/lib/auth';
import { db } from '@/lib/db';
import { rentRefDto } from '@/lib/rent-refs';

export const GET = guarded(async () => {
  const [refs, cities] = await Promise.all([
    db.rentReference.findMany({ orderBy: [{ city: 'asc' }, { year: 'desc' }, { sizeMin: 'asc' }] }),
    db.cityState.findMany(),
  ]);
  const stateOf = new Map(cities.map((c) => [c.cityKey, c.state as StateCode]));
  const csv = rentRowsToCsv(
    refs.map((r) => ({ ...rentRefDto(r), state: stateOf.get(normalizeCityKey(r.city)) ?? null })),
  );
  return new Response(csv, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="rent-references-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
});
