import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { AnalysisTools } from '@/components/AnalysisTools';
import { AnalysisView } from '@/components/AnalysisView';
import { fullAnalysis } from '@/lib/analysis';
import { propertyLabel, toInput } from '@/lib/properties';
import { loadAssumptions, loadReference } from '@/lib/reference';
import { findActiveShare } from '@/lib/share';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Shared property analysis',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

/** Public, read-only, no navigation, no notes/status (SPEC §7.1). */
export default async function SharePage({ params }: { params: Promise<{ token: string }> }) {
  const link = await findActiveShare((await params).token);
  if (!link) notFound();
  const p = link.property;
  const { analysis, schedule, sensitivity } = fullAnalysis(toInput(p), await loadAssumptions(), await loadReference()); // prettier-ignore

  return (
    <main className="mx-auto max-w-4xl space-y-4 p-4 sm:p-6">
      <header>
        <p className="text-xs uppercase tracking-wide text-slate-500">
          Shared analysis · read-only
        </p>
        <h1 className="text-2xl font-semibold">{propertyLabel(p)}</h1>
        {p.title && <p className="text-slate-600">{p.title}</p>}
        {p.url && (
          <a href={p.url} target="_blank" rel="noreferrer noopener" className="text-sm underline">
            Original listing ↗
          </a>
        )}
        {link.expiresAt && (
          <p className="text-xs text-slate-500">
            Link valid until{' '}
            {link.expiresAt.toLocaleDateString('de-DE', { timeZone: 'Europe/Berlin' })}
          </p>
        )}
      </header>
      <AnalysisView analysis={analysis} />
      <AnalysisTools analysis={analysis} schedule={schedule} sensitivity={sensitivity} />
    </main>
  );
}
