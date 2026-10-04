import type { ReferenceData } from '@immo/calc';
import { z } from 'zod';
import { DEMO_RENT_REFERENCES } from './rent-demo';
import { transferTaxRowSchema } from './schemas';
import transferTaxJson from './transfer-tax.json' with { type: 'json' };

export * from './schemas';
export * from './defaults';
export * from './size-bands';
export * from './cities';
export * from './rent-demo';

export const TRANSFER_TAX = z.array(transferTaxRowSchema).parse(transferTaxJson);

/** Bundled fallback reference data (used by the extension when the app is offline). */
export const BUNDLED_REFERENCE: ReferenceData = {
  transferTax: TRANSFER_TAX.map(({ state, rate, validFrom }) => ({ state, rate, validFrom })),
  rentRefs: DEMO_RENT_REFERENCES,
};
export * from './csv';
