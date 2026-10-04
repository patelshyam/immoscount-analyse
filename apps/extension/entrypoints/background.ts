import { browser } from 'wxt/browser';
import { defineBackground } from 'wxt/utils/define-background';
import { apiFetch, testConnection, type Message } from '@/src/api';
import { getBootstrap } from '@/src/bootstrap';
import { getSettings } from '@/src/settings';

// Only the service worker talks to the app (avoids CORS/mixed content on HTTPS portal pages).
export default defineBackground(() => {
  const refresh = async () => void (await getBootstrap(await getSettings(), true));
  browser.runtime.onStartup.addListener(refresh);
  browser.runtime.onInstalled.addListener(refresh);

  browser.runtime.onMessage.addListener((msg: Message, _sender, sendResponse) => {
    void (async () => {
      const settings = await getSettings();
      if (msg.type === 'testConnection') {
        const r = await testConnection(settings);
        if (r.authorized) await getBootstrap(settings, true);
        sendResponse(r);
      } else if (msg.type === 'bootstrap') {
        sendResponse(await getBootstrap(settings, msg.force));
      } else if (msg.type === 'api') {
        sendResponse(await apiFetch(settings, msg.path, { method: msg.method, body: msg.body }));
      }
    })();
    return true; // async response
  });
});
