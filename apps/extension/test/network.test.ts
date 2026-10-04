import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiFetch } from '../src/api';

const PORTALS = /immobilienscout24\.de|immowelt\.de/;
const settings = { apiBaseUrl: 'http://127.0.0.1:3000', apiToken: 't' };

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('apiFetch only talks to the local app', () => {
  it('calls apiBaseUrl with the bearer token', async () => {
    const fetchMock = vi.fn(async () => Response.json({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);
    const r = await apiFetch(settings, '/api/health');
    expect(r.ok).toBe(true);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [URL, RequestInit];
    expect(String(url)).toBe('http://127.0.0.1:3000/api/health');
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer t');
  });

  it.each([
    ['https://www.immobilienscout24.de', '/api/x'],
    ['https://www.immowelt.de', '/api/x'],
    ['http://example.com', '/api/x'],
    ['http://127.0.0.1:3000', 'https://www.immobilienscout24.de/expose/1'],
    ['http://127.0.0.1:3000', '//www.immowelt.de/api/x'],
  ])('refuses base %s + path %s without any request', async (apiBaseUrl, path) => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const r = await apiFetch({ ...settings, apiBaseUrl }, path);
    expect(r.ok).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('reports offline instead of throwing', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))),
    );
    expect(await apiFetch(settings, '/api/health')).toMatchObject({
      ok: false,
      error: 'App offline',
    });
  });
});

describe('no other network code in the extension', () => {
  const root = join(import.meta.dirname, '..');
  const files = (dir: string): string[] =>
    readdirSync(dir).flatMap((f) => {
      const p = join(dir, f);
      return statSync(p).isDirectory() ? files(p) : /\.(ts|tsx)$/.test(f) ? [p] : [];
    });
  const sources = [...files(join(root, 'src')), ...files(join(root, 'entrypoints'))];

  it('only src/api.ts uses fetch/XHR/WebSocket/sendBeacon', () => {
    const offenders = sources.filter(
      (f) =>
        !f.endsWith(join('src', 'api.ts')) &&
        /\bfetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon|EventSource/.test(
          readFileSync(f, 'utf8'),
        ),
    );
    expect(offenders).toEqual([]);
  });

  it('portal domains appear only in URL matching, never as request targets', () => {
    const api = readFileSync(join(root, 'src', 'api.ts'), 'utf8');
    expect(PORTALS.test(api)).toBe(false);
  });
});
