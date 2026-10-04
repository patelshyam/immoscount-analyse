import { z } from 'zod';
import { transferTaxRowSchema } from './schemas';
import transferTaxJson from './transfer-tax.json' with { type: 'json' };

export * from './schemas';
export * from './defaults';

export const TRANSFER_TAX = z.array(transferTaxRowSchema).parse(transferTaxJson);
