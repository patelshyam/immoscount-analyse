import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { getBootstrap, MAX_AGE_MS } from '../src/bootstrap';

const settings = { apiBaseUrl: 'http://127.0.0.1:3000', apiToken: 't' };
const DATA = {
  assumptions: {},
  transferTax: [],
  rentRefs: [],
  cityState: [],
  statuses: [],
  saved: [],
};

beforeEach(() => {
  fakeBrowser.reset();
  vi.unstubAllGlobals();
});

describe('getBootstrap', () => {
  it('fetches, caches, and serves from cache within 10 minutes', async () => {
    const fetchMock = vi.fn(async () => Response.json(DATA));
    vi.stubGlobal('fetch', fetchMock);
    expect(await getBootstrap(settings, false, 1000)).toEqual({ data: DATA, online: true });
    expect(await getBootstrap(settings, false, 1000 + MAX_AGE_MS - 1)).toEqual({
      data: DATA,
      online: true,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await getBootstrap(settings, false, 1000 + MAX_AGE_MS + 1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('offline → last cached copy with online=false', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json(DATA)),
    );
    await getBootstrap(settings, false, 0);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Promise.reject(new TypeError('offline'))),
    );
    expect(await getBootstrap(settings, true, 1)).toEqual({ data: DATA, online: false });
  });

  it('cache for another API base URL is not used', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json(DATA)),
    );
    await getBootstrap(settings, false, 0);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Promise.reject(new TypeError('offline'))),
    );
    const other = { ...settings, apiBaseUrl: 'http://127.0.0.1:3001' };
    expect(await getBootstrap(other, false, 1)).toEqual({ data: null, online: false });
  });
});
