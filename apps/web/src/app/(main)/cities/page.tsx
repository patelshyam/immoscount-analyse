import { fmtEur, fmtPct } from '@immo/calc';
import type { Metadata } from 'next';
import Link from 'next/link';
import { compareCities } from '@/lib/cities';
import { listRows } from '@/lib/properties';
import { loadAssumptions, loadReference } from '@/lib/reference';

export const metadata: Metadata = { title: 'Cities · immo-analyzer' };
export const dynamic = 'force-dynamic';

export default async function CitiesPage() {
  const ref = await loadReference();
  const cities = compareCities(await listRows(await loadAssumptions(), ref), ref.rentRefs);
  const anyPlaceholder = cities.some((c) => c.referenceIsPlaceholder);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">City comparison</h1>
      <p className="text-sm text-slate-600">
        Saved properties and reference rents per city. Implied gross yield = reference rent €/m² ×
        12 ÷ median price/m² of your saved properties.
      </p>
      {anyPlaceholder && (
        <p className="rounded border border-amber-300 bg-amber-50 p-2 text-sm text-amber-900">
          ⚠ Rows marked “placeholder” use fake demo rents. Enter real values under{' '}
          <Link href="/data" className="underline">
            Data
          </Link>
          .
        </p>
      )}
      {cities.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-600">
          No cities yet — save properties or add rent references.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm tabular-nums">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2">City</th>
                <th className="px-3 py-2 text-right">Saved</th>
                <th className="px-3 py-2 text-right">Median price/m²</th>
                <th className="px-3 py-2 text-right">Avg gross</th>
                <th className="px-3 py-2 text-right">Avg net</th>
                <th className="px-3 py-2 text-right">Reference rent/m²</th>
                <th className="px-3 py-2 text-right">Implied gross</th>
              </tr>
            </thead>
            <tbody>
              {cities.map((c) => (
                <tr key={c.cityKey} className="border-t border-slate-100">
                  <td className="px-3 py-2 font-medium">{c.city}</td>
                  <td className="px-3 py-2 text-right">{c.count}</td>
                  <td className="px-3 py-2 text-right">{fmtEur(c.medianPricePerM2)}</td>
                  <td className="px-3 py-2 text-right">{fmtPct(c.avgGrossYield)}</td>
                  <td className="px-3 py-2 text-right">{fmtPct(c.avgNetYield)}</td>
                  <td className="px-3 py-2 text-right">
                    {fmtEur(c.referenceRentPerM2, true)}
                    {c.referenceIsPlaceholder && (
                      <span className="ml-1 rounded bg-amber-100 px-1 text-xs text-amber-900">
                        placeholder
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">{fmtPct(c.impliedGrossYield)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
