import { randomBytes } from 'node:crypto';
import { DEFAULT_ASSUMPTIONS, DEFAULT_PIPELINE_STATUSES, TRANSFER_TAX } from '@immo/data';
import { db } from './db';

export const newToken = () => randomBytes(32).toString('base64url');

/** Idempotent: only inserts what is missing, never overwrites user edits. */
export async function seed() {
  if ((await db.pipelineStatus.count()) === 0) {
    await db.pipelineStatus.createMany({
      data: DEFAULT_PIPELINE_STATUSES.map((s, i) => ({ ...s, sortOrder: i })),
    });
  }

  await db.settings.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, assumptions: DEFAULT_ASSUMPTIONS, apiToken: newToken() },
  });

  await db.transferTaxRate.createMany({
    skipDuplicates: true,
    data: TRANSFER_TAX.map((r) => ({
      state: r.state,
      rate: r.rate,
      validFrom: r.validFrom ? new Date(r.validFrom) : null,
      verifiedOn: r.verifiedOn ? new Date(r.verifiedOn) : null,
      source: r.source,
    })),
  });
}
