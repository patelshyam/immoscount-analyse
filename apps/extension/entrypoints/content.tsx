import type { StateCode } from '@immo/calc';
import { BUNDLED_REFERENCE, CITY_STATE, DEFAULT_ASSUMPTIONS } from '@immo/data';
import { createRoot, type Root } from 'react-dom/client';
import { browser } from 'wxt/browser';
import type { ContentScriptContext } from 'wxt/utils/content-script-context';
import { createShadowRootUi } from 'wxt/utils/content-script-ui/shadow-root';
import { defineContentScript } from 'wxt/utils/define-content-script';
import { Panel } from '@/src/panel/Panel';
import '@/src/panel/panel.css';
import { parserFor } from '@/src/parsers';
import type { ParsedListing } from '@/src/parsers/types';
import { getSettings } from '@/src/settings';

const CITY_STATES = new Map<string, StateCode>(CITY_STATE.map((r) => [r.cityKey, r.state]));

async function mountPanel(ctx: ContentScriptContext, listing: ParsedListing) {
  const { panelCollapsed } = await browser.storage.local.get('panelCollapsed');
  let collapsed = panelCollapsed === true;

  const ui = await createShadowRootUi<Root>(ctx, {
    name: 'immo-analyzer-panel',
    position: 'inline',
    anchor: 'body',
    append: 'last',
    isolateEvents: true,
    onMount(container) {
      const root = createRoot(container);
      const render = () =>
        root.render(
          <Panel
            listing={listing}
            assumptions={DEFAULT_ASSUMPTIONS}
            reference={BUNDLED_REFERENCE}
            cityStates={CITY_STATES}
            collapsed={collapsed}
            onCollapsedChange={(c) => {
              collapsed = c;
              void browser.storage.local.set({ panelCollapsed: c });
              render();
            }}
          />,
        );
      render();
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
      if (parser.pageType(document, url) === 'listing_buy') {
        current = await mountPanel(ctx, parser.parseListing(document, url));
      }
    };

    await run();
    ctx.addEventListener(window, 'wxt:locationchange', () => void run());
  },
});
