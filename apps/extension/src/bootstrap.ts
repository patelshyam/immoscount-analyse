import type { Assumptions, RentRef, StateCode, TransferTaxEntry } from '@immo/calc';
import { browser } from 'wxt/browser';
import { apiFetch } from './api';
import type { ExtSettings } from './settings';

export interface SavedRef {
  id: string;
  source: 'is24' | 'immowelt';
  externalId: string;
  statusId: string;
}

export interface StatusRef {
  id: string;
  name: string;
  color: string;
  kind: 'open' | 'excluded' | 'closed';
}

/** Shape of GET /api/extension/bootstrap */
export interface Bootstrap {
  assumptions: Assumptions;
  transferTax: TransferTaxEntry[];
  rentRefs: RentRef[];
  cityState: { cityKey: string; state: StateCode }[];
  statuses: StatusRef[];
  saved: SavedRef[];
}

export interface BootstrapResult {
  data: Bootstrap | null;
  online: boolean;
}

interface Cached {
  data: Bootstrap;
  fetchedAt: number;
  apiBaseUrl: string;
}

export const MAX_AGE_MS = 10 * 60 * 1000;

/**
 * Cached in storage.local. Refreshed when older than 10 minutes (or forced); on failure the
 * last cached copy is returned with online=false, and callers fall back to bundled data.
 */
export async function getBootstrap(
  settings: Pick<ExtSettings, 'apiBaseUrl' | 'apiToken'>,
  force = false,
  now = Date.now(),
): Promise<BootstrapResult> {
  const { bootstrap } = (await browser.storage.local.get('bootstrap')) as { bootstrap?: Cached };
  const fresh =
    bootstrap &&
    bootstrap.apiBaseUrl === settings.apiBaseUrl &&
    now - bootstrap.fetchedAt < MAX_AGE_MS;
  if (fresh && !force) return { data: bootstrap.data, online: true };

  const res = await apiFetch<Bootstrap>(settings, '/api/extension/bootstrap');
  if (res.ok && res.data) {
    await browser.storage.local.set({
      bootstrap: {
        data: res.data,
        fetchedAt: now,
        apiBaseUrl: settings.apiBaseUrl,
      } satisfies Cached,
    });
    return { data: res.data, online: true };
  }
  const usable = bootstrap?.apiBaseUrl === settings.apiBaseUrl ? bootstrap.data : null;
  return { data: usable, online: false };
}
