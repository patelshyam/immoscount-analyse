import type { Metadata } from 'next';
import { db } from '@/lib/db';
import { loadAssumptions } from '@/lib/reference';
import { AssumptionsForm } from './AssumptionsForm';
import { TokenPanel } from './TokenPanel';

export const metadata: Metadata = { title: 'Settings · immo-analyzer' };
export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const [assumptions, settings] = await Promise.all([
    loadAssumptions(),
    db.settings.findUnique({ where: { id: 1 }, select: { apiToken: true } }),
  ]);
  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Assumptions</h2>
        <p className="text-sm text-slate-600">
          Starting defaults, not facts — set them to your own numbers (e.g. your bank&apos;s actual
          interest offer).
        </p>
        <AssumptionsForm initial={assumptions} />
      </section>
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">API token</h2>
        <p className="text-sm text-slate-600">
          Paste this into the Chrome extension&apos;s options so it can talk to the app.
        </p>
        <TokenPanel initial={settings?.apiToken ?? ''} />
      </section>
    </div>
  );
}
