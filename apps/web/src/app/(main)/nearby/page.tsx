import type { Metadata } from 'next';
import Link from 'next/link';
import { NearbyView } from '@/components/NearbyView';
import { db } from '@/lib/db';
import { cachedNearby } from '@/lib/nearby/lookup';

export const metadata: Metadata = { title: 'Nearby · immo-analyzer' };
export const dynamic = 'force-dynamic';

type Props = { searchParams: Promise<{ address?: string }> };

export default async function NearbyPage({ searchParams }: Props) {
  const address = (await searchParams).address?.trim() ?? '';
  const [initial, saved] = await Promise.all([
    address ? cachedNearby(address) : null,
    db.nearbyLookup.findMany({
      orderBy: { fetchedAt: 'desc' },
      take: 50,
      select: { id: true, address: true, fetchedAt: true },
    }),
  ]);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_240px]">
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Nearby</h1>
        <p className="text-sm text-slate-600">
          Schulen, Kindergärten, Supermärkte, ÖPNV, Ärzte, Krankenhäuser, Apotheken, Restaurants,
          Parks and Banken around any address — everything within 2 km, otherwise the nearest one.
          Every search is saved and shown from the database next time.
        </p>
        <NearbyView key={address} initialAddress={address} initial={initial} />
      </div>
      <aside className="space-y-2">
        <h2 className="text-sm font-semibold text-slate-700">Saved searches</h2>
        {saved.length === 0 ? (
          <p className="text-sm text-slate-500">None yet.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {saved.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/nearby?address=${encodeURIComponent(s.address)}`}
                  className="hover:underline"
                >
                  {s.address}
                </Link>
                <span className="ml-1 text-xs text-slate-400">
                  {s.fetchedAt.toLocaleDateString('de-DE')}
                </span>
              </li>
            ))}
          </ul>
        )}
      </aside>
    </div>
  );
}
