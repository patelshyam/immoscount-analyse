import { normalizeCityKey, type ReferenceData, type StateCode } from '@immo/calc';
import { BUNDLED_REFERENCE, CITY_STATE, DEFAULT_ASSUMPTIONS } from '@immo/data';
import { useEffect, useMemo, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { browser } from 'wxt/browser';
import type { ContentScriptContext } from 'wxt/utils/content-script-context';
import { createShadowRootUi } from 'wxt/utils/content-script-ui/shadow-root';
import { defineContentScript } from 'wxt/utils/define-content-script';
import { startBadges } from '@/src/badges';
import type { Bootstrap } from '@/src/bootstrap';
import { api, bootstrap, listingPayload } from '@/src/messaging';
import { Panel } from '@/src/panel/Panel';
import '@/src/panel/panel.css';
import { SaveControls } from '@/src/panel/SaveControls';
import { parserFor } from '@/src/parsers';
import type { ParsedListing } from '@/src/parsers/types';
import { getSettings, type ExtSettings } from '@/src/settings';

const BUNDLED_CITY_STATES = new Map<string, StateCode>(CITY_STATE.map((r) => [r.cityKey, r.state]));

function App({
  listing,
  settings,
  initial,
  online: initialOnline,
  initialCollapsed,
}: {
  listing: ParsedListing;
  settings: ExtSettings;
  initial: Bootstrap | null;
  online: boolean;
  initialCollapsed: boolean;
}) {
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const [online, setOnline] = useState(initialOnline);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(
    () =>
      initial?.saved.find(
        (s) => s.source === listing.source && s.externalId === listing.externalId,
      ) ?? null,
  );

  const reference: ReferenceData = initial
    ? { transferTax: initial.transferTax, rentRefs: initial.rentRefs }
    : BUNDLED_REFERENCE;
  const cityStates = useMemo(
    () =>
      initial ? new Map(initial.cityState.map((r) => [r.cityKey, r.state])) : BUNDLED_CITY_STATES,
    [initial],
  );
  const resolvedState =
    listing.state ??
    (listing.city ? (cityStates.get(normalizeCityKey(listing.city)) ?? null) : null);

  // Passive revisit: the page was opened by the user; tell the app so it can snapshot changes.
  useEffect(() => {
    const body = listingPayload(listing, resolvedState);
    if (!saved || !online || !body) return;
    void api('/api/properties', 'POST', body);
  }, []); // once per mounted listing

  async function add(state: StateCode | null) {
    const body = listingPayload(listing, state);
    if (!body) return;
    const r = await api<{ id: string; statusId: string }>('/api/properties', 'POST', body);
    if (r.ok && r.data) {
      setSaved({ ...r.data, source: listing.source, externalId: listing.externalId ?? '' });
      setError(null);
      void bootstrap(true); // refresh saved index for badges
    } else {
      setOnline(r.status !== 0);
      setError(
        r.status === 401 ? 'Token rejected — check the extension options.' : 'Saving failed.',
      );
    }
  }

  async function changeStatus(statusId: string) {
    if (!saved) return;
    const r = await api(`/api/properties/${saved.id}/status`, 'POST', { statusId });
    if (r.ok) setSaved({ ...saved, statusId });
    else setError('Status change failed.');
  }

  return (
    <Panel
      listing={listing}
      assumptions={initial?.assumptions ?? DEFAULT_ASSUMPTIONS}
      reference={reference}
      cityStates={cityStates}
      collapsed={collapsed}
      onCollapsedChange={(c) => {
        setCollapsed(c);
        void browser.storage.local.set({ panelCollapsed: c });
      }}
      onStatePicked={(city, state) => {
        if (online) void api('/api/city-state', 'POST', { city, state });
      }}
      footer={(state) => (
        <SaveControls
          online={online}
          canSave={listingPayload(listing, state) !== null}
          saved={saved}
          statuses={initial?.statuses ?? []}
          appUrl={settings.apiBaseUrl}
          onAdd={() => add(state)}
          onStatusChange={changeStatus}
          error={error}
        />
      )}
    />
  );
}

async function mountPanel(
  ctx: ContentScriptContext,
  listing: ParsedListing,
  settings: ExtSettings,
) {
  const [{ panelCollapsed }, boot] = await Promise.all([
    browser.storage.local.get('panelCollapsed'),
    bootstrap().catch(() => ({ data: null, online: false })),
  ]);

  const ui = await createShadowRootUi<Root>(ctx, {
    name: 'immo-analyzer-panel',
    position: 'inline',
    anchor: 'body',
    append: 'last',
    isolateEvents: true,
    onMount(container) {
      const root = createRoot(container);
      root.render(
        <App
          listing={listing}
          settings={settings}
          initial={boot.data}
          online={boot.online}
          initialCollapsed={panelCollapsed === true}
        />,
      );
      return root;
    },
    onRemove: (root) => root?.unmount(),
  });
  ui.mount();
  return ui;
}

export default defineContentScript({
  matches: ['https://www.immobilienscout24.de/*', 'https://www.immowelt.de/*'],
  cssInjectionMode: 'ui',
  async main(ctx) {
    const settings = await getSettings();
    let current: { remove(): void } | null = null;

    const run = async () => {
      current?.remove();
      current = null;
      const url = new URL(location.href);
      const parser = parserFor(url);
      if (!parser) return;
      if ((parser.id === 'is24' && !settings.enableIs24) || (parser.id === 'immowelt' && !settings.enableImmowelt)) return; // prettier-ignore
      const type = parser.pageType(document, url);
      if (type === 'listing_buy') {
        current = await mountPanel(ctx, parser.parseListing(document, url), settings);
      } else if (type === 'search' && settings.enableBadges) {
        const { data } = await bootstrap().catch(() => ({ data: null }));
        const stop = startBadges(document, (d) => parser.parseSearchCards(d), {
          source: parser.id,
          assumptions: data?.assumptions ?? DEFAULT_ASSUMPTIONS,
          reference: data
            ? { transferTax: data.transferTax, rentRefs: data.rentRefs }
            : BUNDLED_REFERENCE,
          cityStates: data
            ? new Map(data.cityState.map((r) => [r.cityKey, r.state]))
            : BUNDLED_CITY_STATES,
          saved: data?.saved ?? [],
          statuses: data?.statuses ?? [],
          exclusionKeywords: settings.exclusionKeywords,
        });
        current = { remove: stop };
      }
    };

    await run();
    ctx.addEventListener(window, 'wxt:locationchange', () => void run());
  },
});
