import {
  analyze,
  fmtEur,
  fmtNum,
  fmtPct,
  normalizeCityKey,
  parseGermanNumber,
  type Assumptions,
  type PropertyInput,
  type ReferenceData,
  type RentSource,
  type StateCode,
} from '@immo/calc';
import { STATE_CODES, STATE_NAMES } from '@immo/data';
import { useMemo, useState, type ReactNode } from 'react';
import type { ParsedListing } from '../parsers/types';

export interface PanelProps {
  listing: ParsedListing;
  assumptions: Assumptions;
  reference: ReferenceData;
  cityStates: ReadonlyMap<string, StateCode>;
  collapsed: boolean;
  onCollapsedChange(collapsed: boolean): void;
  /** Phase 3: save controls are rendered here */
  footer?: ReactNode;
}

const RENT_LABEL: Record<RentSource, string> = {
  override: 'manual',
  actual: 'actual',
  reference: 'estimated',
  placeholder_reference: 'placeholder',
  none: 'missing',
};

const VERDICT_LABEL = { green: 'Meets target', orange: 'Close to target', red: 'Below target', unknown: 'Unknown' }; // prettier-ignore

function NumberInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: number | null;
  onChange(v: number | null): void;
  placeholder?: string;
}) {
  return (
    <label className="ia-field">
      <span>{label}</span>
      <input
        inputMode="decimal"
        defaultValue={value == null ? '' : String(value).replace('.', ',')}
        placeholder={placeholder}
        onChange={(e) => onChange(parseGermanNumber(e.currentTarget.value))}
      />
    </label>
  );
}

export function Panel(p: PanelProps) {
  const { listing: l, assumptions: a } = p;
  const [rentOverride, setRentOverride] = useState<number | null>(null);
  const [hausgeld, setHausgeld] = useState<number | null>(l.hausgeldMonthly);
  const [stateOverride, setStateOverride] = useState<StateCode | null>(null);
  const [equityIdx, setEquityIdx] = useState(() =>
    Math.max(0, a.equityScenarios.indexOf(a.defaultEquityShare)),
  );

  const mappedState = l.city ? (p.cityStates.get(normalizeCityKey(l.city)) ?? null) : null;
  const state = stateOverride ?? mappedState;
  const isApartment = (l.propertyType ?? 'apartment') === 'apartment';

  const analysis = useMemo(() => {
    if (l.price == null || l.livingArea == null) return null;
    const input: PropertyInput = {
      price: l.price,
      livingArea: l.livingArea,
      rooms: l.rooms,
      propertyType: l.propertyType ?? 'apartment',
      city: l.city,
      state,
      hausgeldMonthly: hausgeld,
      actualColdRentMonthly: l.actualColdRentMonthly,
      rentOverrideMonthly: rentOverride,
      brokerFeeOverride: l.brokerFee,
      renovationCost: 0,
    };
    return analyze(input, a, p.reference);
  }, [l, a, p.reference, state, hausgeld, rentOverride]);

  if (p.collapsed) {
    return (
      <button className="ia-tab" onClick={() => p.onCollapsedChange(false)} title="Open analysis">
        <span className={`ia-dot ia-${analysis?.verdict ?? 'unknown'}`} />
        {fmtPct(analysis?.netYield ?? null, 1)}
      </button>
    );
  }

  const scenario = analysis?.scenarios[equityIdx];
  const warnings = [...l.warnings, ...(analysis?.warnings ?? [])];

  return (
    <aside className="ia-panel" aria-label="immo-analyzer">
      <header className="ia-header">
        <div>
          <div className="ia-title">
            {[l.city, l.rooms != null && `${fmtNum(l.rooms, 1)} Zi.`, l.livingArea != null && `${fmtNum(l.livingArea, 1)} m²`] // prettier-ignore
              .filter(Boolean)
              .join(' · ') || 'Listing'}
          </div>
          <div className="ia-sub">{fmtEur(l.price)}</div>
        </div>
        <button className="ia-icon" onClick={() => p.onCollapsedChange(true)} title="Collapse">
          ›
        </button>
      </header>

      {!analysis ? (
        <p className="ia-muted">Couldn&apos;t read price or living area from this page.</p>
      ) : (
        <>
          <div className={`ia-pill ia-${analysis.verdict}`}>{VERDICT_LABEL[analysis.verdict]}</div>

          <div className="ia-grid">
            <div className="ia-metric">
              <span>Gross yield</span>
              <strong>{fmtPct(analysis.grossYield)}</strong>
            </div>
            <div className="ia-metric">
              <span>Net yield</span>
              <strong>{fmtPct(analysis.netYield)}</strong>
            </div>
            <div className="ia-metric">
              <span>Cashflow / mo</span>
              <strong className={(scenario?.monthlyCashflow ?? 0) < 0 ? 'ia-neg' : ''}>
                {fmtEur(scenario?.monthlyCashflow ?? null)}
              </strong>
              <div className="ia-seg" role="group" aria-label="Equity">
                {a.equityScenarios.map((e, i) => (
                  <button
                    key={e}
                    className={i === equityIdx ? 'ia-on' : ''}
                    onClick={() => setEquityIdx(i)}
                  >
                    {fmtPct(e, 0)}
                  </button>
                ))}
              </div>
            </div>
            <div className="ia-metric">
              <span>Price / m²</span>
              <strong>{fmtEur(analysis.pricePerM2)}</strong>
            </div>
          </div>

          <div className="ia-rent">
            <span>Kaltmiete {fmtEur(analysis.rent.monthly)}</span>
            <span className={`ia-badge ia-src-${analysis.rent.source}`}>
              {RENT_LABEL[analysis.rent.source]}
            </span>
          </div>

          <div className="ia-inputs">
            <NumberInput
              label="Rent override €/mo"
              value={rentOverride}
              onChange={setRentOverride}
            />
            {isApartment && (
              <NumberInput label="Hausgeld €/mo" value={hausgeld} onChange={setHausgeld} />
            )}
            <label className="ia-field">
              <span>State</span>
              <select
                value={state ?? ''}
                onChange={(e) =>
                  setStateOverride((e.currentTarget.value || null) as StateCode | null)
                }
              >
                <option value="">Unknown (highest tax)</option>
                {STATE_CODES.map((s) => (
                  <option key={s} value={s}>
                    {STATE_NAMES[s]}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <details className="ia-details">
            <summary>Details</summary>
            <table>
              <tbody>
                <tr>
                  <td>Grunderwerbsteuer ({fmtPct(analysis.transferTaxRate)})</td>
                  <td>{fmtEur(analysis.costs.transferTax)}</td>
                </tr>
                <tr>
                  <td>Notary + registry</td>
                  <td>{fmtEur(analysis.costs.notary)}</td>
                </tr>
                <tr>
                  <td>Broker ({fmtPct(analysis.brokerFeeRate)})</td>
                  <td>{fmtEur(analysis.costs.broker)}</td>
                </tr>
                <tr>
                  <td>
                    <b>Total cost</b>
                  </td>
                  <td>
                    <b>{fmtEur(analysis.costs.total)}</b>
                  </td>
                </tr>
                {analysis.noi && (
                  <>
                    <tr>
                      <td>Rent × 12</td>
                      <td>{fmtEur(analysis.noi.grossRentAnnual)}</td>
                    </tr>
                    <tr>
                      <td>− Vacancy</td>
                      <td>{fmtEur(-analysis.noi.vacancy)}</td>
                    </tr>
                    <tr>
                      <td>− Hausgeld (non-recoverable)</td>
                      <td>{fmtEur(-analysis.noi.hausgeldNonRecoverable)}</td>
                    </tr>
                    <tr>
                      <td>− Maintenance</td>
                      <td>{fmtEur(-analysis.noi.maintenance)}</td>
                    </tr>
                    <tr>
                      <td>− Management</td>
                      <td>{fmtEur(-analysis.noi.management)}</td>
                    </tr>
                    <tr>
                      <td>
                        <b>NOI / year</b>
                      </td>
                      <td>
                        <b>{fmtEur(analysis.noi.total)}</b>
                      </td>
                    </tr>
                  </>
                )}
                <tr>
                  <td>Interest + Tilgung</td>
                  <td>
                    {fmtPct(a.interestRate)} + {fmtPct(a.initialRepayment)}
                  </td>
                </tr>
                <tr>
                  <td>Target net yield</td>
                  <td>{fmtPct(a.targetNetYield)}</td>
                </tr>
              </tbody>
            </table>
          </details>

          <details className="ia-details">
            <summary>What-if ({fmtPct(analysis.whatIf.equityShare, 0)} equity)</summary>
            <table>
              <tbody>
                <tr>
                  <td>Break-even price</td>
                  <td>{fmtEur(analysis.whatIf.breakEvenPrice)}</td>
                </tr>
                <tr>
                  <td>Price for target yield</td>
                  <td>{fmtEur(analysis.whatIf.priceForTargetYield)}</td>
                </tr>
                <tr>
                  <td>Rent for target yield</td>
                  <td>{fmtEur(analysis.whatIf.requiredRentForTarget)}</td>
                </tr>
                <tr>
                  <td>Rent for zero cashflow</td>
                  <td>{fmtEur(analysis.whatIf.requiredRentForZeroCashflow)}</td>
                </tr>
              </tbody>
            </table>
          </details>
        </>
      )}

      {p.footer}

      {warnings.length > 0 && (
        <ul className="ia-warnings">
          {warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      )}
      <p className="ia-disclaimer">Estimates only — not financial, tax or investment advice.</p>
    </aside>
  );
}
