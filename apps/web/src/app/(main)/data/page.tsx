import type { Metadata } from 'next';
import { db } from '@/lib/db';
import { rentRefDto } from '@/lib/rent-refs';
import { CityStateEditor } from './CityStateEditor';
import { RentRefEditor } from './RentRefEditor';
import { TransferTaxEditor } from './TransferTaxEditor';

export const metadata: Metadata = { title: 'Data · immo-analyzer' };
export const dynamic = 'force-dynamic';

const iso = (d: Date | null) => d?.toISOString().slice(0, 10) ?? null;

export default async function DataPage() {
  const [tax, cities, refs] = await Promise.all([
    db.transferTaxRate.findMany({ orderBy: { state: 'asc' } }),
    db.cityState.findMany({ orderBy: { displayName: 'asc' } }),
    db.rentReference.findMany({ orderBy: [{ city: 'asc' }, { year: 'desc' }, { sizeMin: 'asc' }] }),
  ]);
  return (
    <div className="space-y-10">
      <h1 className="text-2xl font-semibold">Reference data</h1>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Rent references (Mietspiegel-style)</h2>
        <p className="text-sm text-slate-600">
          €/m² Kaltmiete per city and size band. Used for rent estimates when a listing has no
          actual rent. Rows marked placeholder are fake demo values.
        </p>
        <RentRefEditor initial={refs.map(rentRefDto)} />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Grunderwerbsteuer</h2>
        <TransferTaxEditor
          initial={tax.map((r) => ({
            state: r.state,
            rate: Number(r.rate),
            validFrom: iso(r.validFrom),
            verifiedOn: iso(r.verifiedOn),
            source: r.source,
          }))}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">City → state</h2>
        <CityStateEditor
          initial={cities.map(({ cityKey, displayName, state }) => ({
            cityKey,
            displayName,
            state,
          }))}
        />
      </section>
    </div>
  );
}
