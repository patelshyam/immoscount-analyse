import { normalizeCityKey } from '@immo/calc';
import type { RentCsvRow } from '@immo/data';
import type { RentReference } from '@/generated/prisma/client.ts';
import { db } from './db';

export const rentRefDto = (r: RentReference) => ({
  id: r.id,
  city: r.city,
  sizeMin: Number(r.sizeMin),
  sizeMax: r.sizeMax == null ? null : Number(r.sizeMax),
  eurPerM2: Number(r.eurPerM2),
  source: r.source,
  year: r.year,
  isPlaceholder: r.isPlaceholder,
  notes: r.notes,
});

/**
 * Upsert rows keyed by (normalized city, size band, year): an existing row is updated, otherwise
 * created. Rows with a state also set the city→state mapping. All in one transaction.
 */
export async function importRentRows(rows: RentCsvRow[]) {
  const existing = await db.rentReference.findMany();
  const key = (city: string, min: number, max: number | null, year: number) =>
    `${normalizeCityKey(city)}|${min}|${max ?? ''}|${year}`;
  const index = new Map(
    existing.map((r) => [
      key(r.city, Number(r.sizeMin), r.sizeMax == null ? null : Number(r.sizeMax), r.year),
      r.id,
    ]),
  );
  let created = 0;
  let updated = 0;
  await db.$transaction(async (tx) => {
    for (const { state, ...row } of rows) {
      const id = index.get(key(row.city, row.sizeMin, row.sizeMax, row.year));
      if (id) {
        await tx.rentReference.update({ where: { id }, data: row });
        updated++;
      } else {
        const r = await tx.rentReference.create({ data: row });
        index.set(key(row.city, row.sizeMin, row.sizeMax, row.year), r.id);
        created++;
      }
      if (state) {
        const cityKey = normalizeCityKey(row.city);
        await tx.cityState.upsert({
          where: { cityKey },
          update: { state },
          create: { cityKey, displayName: row.city, state },
        });
      }
    }
  });
  return { created, updated };
}
