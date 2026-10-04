import type { Metadata } from 'next';
import { NearbyView } from '@/components/NearbyView';

export const metadata: Metadata = { title: 'Nearby · immo-analyzer' };

export default function NearbyPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Nearby</h1>
      <p className="text-sm text-slate-600">
        Schulen, Kindergärten, Supermärkte, ÖPNV, Ärzte, Krankenhäuser, Apotheken, Restaurants,
        Parks and Banken around any address — everything within 2 km, otherwise the nearest one.
      </p>
      <NearbyView initialAddress="" initial={null} />
    </div>
  );
}
