import { browser } from 'wxt/browser';
import { defineBackground } from 'wxt/utils/define-background';
import { apiFetch, testConnection, type Message } from '@/src/api';
import { getSettings } from '@/src/settings';

// Only the service worker talks to the app (avoids CORS/mixed content on HTTPS portal pages).
export default defineBackground(() => {
  browser.runtime.onMessage.addListener((msg: Message, _sender, sendResponse) => {
    void (async () => {
      const settings = await getSettings();
      if (msg.type === 'testConnection') sendResponse(await testConnection(settings));
      else if (msg.type === 'api') {
        sendResponse(await apiFetch(settings, msg.path, { method: msg.method, body: msg.body }));
      }
    })();
    return true; // async response
  });
});
