import { analyze, fmtEur } from '@immo/calc';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { AnalysisView } from '@/components/AnalysisView';
import { StatusBadge } from '@/components/StatusBadge';
import { db } from '@/lib/db';
import { propertyLabel, toInput } from '@/lib/properties';
import { loadAssumptions, loadReference } from '@/lib/reference';
import { PropertyEditor, type EditableProperty } from './PropertyEditor';
import { StatusChanger } from './StatusChanger';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ id: string }> };

const SOURCE = { is24: 'ImmoScout24', immowelt: 'Immowelt', manual: 'Manual entry' };
const dt = (d: Date) =>
  d.toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Berlin' });

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = await db.property.findUnique({ where: { id: (await params).id } });
  return { title: p ? `${propertyLabel(p)} · immo-analyzer` : 'Not found' };
}

export default async function PropertyPage({ params }: Props) {
  const { id } = await params;
  const [p, statuses, assumptions, ref] = await Promise.all([
    db.property.findUnique({
      where: { id },
      include: {
        status: true,
        snapshots: { orderBy: { capturedAt: 'desc' } },
        statusEvents: { orderBy: { at: 'desc' }, include: { fromStatus: true, toStatus: true } },
      },
    }),
    db.pipelineStatus.findMany({ orderBy: { sortOrder: 'asc' } }),
    loadAssumptions(),
    loadReference(),
  ]);
  if (!p) notFound();

  const analysis = analyze(toInput(p), assumptions, ref);
  const n = (d: { toString(): string } | null) => (d == null ? null : Number(d));
  const editable: EditableProperty = {
    id: p.id,
    title: p.title,
    propertyType: p.propertyType,
    street: p.street,
    postalCode: p.postalCode,
    city: p.city,
    state: p.state,
    price: Number(p.price),
    livingArea: Number(p.livingArea),
    rooms: n(p.rooms),
    hausgeldMonthly: n(p.hausgeldMonthly),
    actualColdRentMonthly: n(p.actualColdRentMonthly),
    rentOverrideMonthly: n(p.rentOverrideMonthly),
    brokerFeeOverride: n(p.brokerFeeOverride),
    renovationCost: Number(p.renovationCost),
    yearBuilt: p.yearBuilt,
    notes: p.notes,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{propertyLabel(p)}</h1>
          {p.title && <p className="text-slate-600">{p.title}</p>}
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-500">
            <StatusBadge name={p.status.name} color={p.status.color} />
            <span>{SOURCE[p.source]}</span>
            {p.url && (
              <a href={p.url} target="_blank" rel="noreferrer noopener" className="underline">
                Open original listing ↗
              </a>
            )}
            <span>· last seen {dt(p.lastSeenAt)}</span>
          </p>
        </div>
        <StatusChanger
          propertyId={p.id}
          statusId={p.statusId}
          statuses={statuses.map(({ id, name }) => ({ id, name }))}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
        <PropertyEditor property={editable} />
        <AnalysisView analysis={analysis} />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="mb-2 text-sm font-semibold text-slate-700">Status history</h2>
          <ul className="space-y-2 text-sm">
            {p.statusEvents.map((e) => (
              <li key={e.id}>
                <span className="text-slate-500">{dt(e.at)}</span> —{' '}
                {e.fromStatus ? `${e.fromStatus.name} → ` : 'Saved as '}
                <strong>{e.toStatus.name}</strong>
                {e.note && <div className="text-slate-600">“{e.note}”</div>}
              </li>
            ))}
          </ul>
        </section>
        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="mb-2 text-sm font-semibold text-slate-700">Price & listing snapshots</h2>
          <table className="w-full text-sm tabular-nums">
            <tbody>
              {p.snapshots.map((s, i) => {
                const prev = p.snapshots[i + 1];
                const delta = prev ? Number(s.price) - Number(prev.price) : 0;
                return (
                  <tr key={s.id} className="border-b border-slate-100 last:border-0">
                    <td className="py-1.5 text-slate-500">{dt(s.capturedAt)}</td>
                    <td className="py-1.5 text-right">{fmtEur(Number(s.price))}</td>
                    <td
                      className={`py-1.5 text-right text-xs ${delta < 0 ? 'text-green-700' : delta > 0 ? 'text-red-700' : 'text-slate-400'}`}
                    >
                      {delta ? `${delta > 0 ? '+' : ''}${fmtEur(delta)}` : ''}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}
