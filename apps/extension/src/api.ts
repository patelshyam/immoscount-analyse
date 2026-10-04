import type { ExtSettings } from './settings';

export interface ApiResult<T = unknown> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
}

const ALLOWED_HOSTS = new Set(['127.0.0.1', 'localhost']);

/**
 * The ONLY network call in the extension (used by the service worker).
 * Hard-limited to the local app: never the portal domains (SPEC §2).
 */
export async function apiFetch<T>(
  settings: Pick<ExtSettings, 'apiBaseUrl' | 'apiToken'>,
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<ApiResult<T>> {
  if (!path.startsWith('/api/')) return { ok: false, status: 0, error: 'invalid path' };
  let url: URL;
  try {
    url = new URL(path, settings.apiBaseUrl);
  } catch {
    return { ok: false, status: 0, error: 'invalid API base URL' };
  }
  if (url.protocol !== 'http:' || !ALLOWED_HOSTS.has(url.hostname)) {
    return { ok: false, status: 0, error: 'API base URL must be http://127.0.0.1 or localhost' };
  }
  try {
    const res = await fetch(url, {
      method: init.method ?? 'GET',
      headers: {
        authorization: `Bearer ${settings.apiToken}`,
        ...(init.body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
    const data = (await res.json().catch(() => undefined)) as T | undefined;
    return { ok: res.ok, status: res.status, data };
  } catch {
    return { ok: false, status: 0, error: 'App offline' };
  }
}

export type Message =
  { type: 'api'; path: string; method?: string; body?: unknown } | { type: 'testConnection' };

export interface ConnectionResult {
  reachable: boolean;
  authorized: boolean;
}

export async function testConnection(
  settings: Pick<ExtSettings, 'apiBaseUrl' | 'apiToken'>,
): Promise<ConnectionResult> {
  const health = await apiFetch(settings, '/api/health');
  if (!health.ok) return { reachable: false, authorized: false };
  const auth = await apiFetch(settings, '/api/settings/assumptions');
  return { reachable: true, authorized: auth.ok };
}
