import type { RentRef } from '@immo/calc';
import { SIZE_BANDS } from './size-bands';

/**
 * Clearly fake demo rows so the UI works before real data is entered.
 * A flat 10 €/m² for every band — NOT market data. Replace via /data or CSV import.
 */
export const DEMO_RENT_REFERENCES: (RentRef & { notes: string })[] = [
  'Berlin',
  'Frankfurt am Main',
  'Leipzig',
].flatMap((city) =>
  SIZE_BANDS.map((b) => ({
    city,
    sizeMin: b.min,
    sizeMax: b.max,
    eurPerM2: 10,
    source: 'DEMO PLACEHOLDER',
    year: 2026,
    isPlaceholder: true,
    notes: 'Fake demo value — replace with real Mietspiegel data.',
  })),
);
