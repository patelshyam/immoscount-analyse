import { browser } from 'wxt/browser';

export interface ExtSettings {
  apiBaseUrl: string;
  apiToken: string;
  enableIs24: boolean;
  enableImmowelt: boolean;
  enableBadges: boolean;
  exclusionKeywords: string[];
}

export const DEFAULT_SETTINGS: ExtSettings = {
  apiBaseUrl: 'http://127.0.0.1:3000',
  apiToken: '',
  enableIs24: true,
  enableImmowelt: true,
  enableBadges: true,
  exclusionKeywords: [
    'Erbbaurecht',
    'Erbpacht',
    'Nießbrauch',
    'Wohnrecht',
    'Zwangsversteigerung',
    'Versteigerung',
  ],
};

export async function getSettings(): Promise<ExtSettings> {
  const { settings } = await browser.storage.local.get('settings');
  return { ...DEFAULT_SETTINGS, ...(settings as Partial<ExtSettings> | undefined) };
}

export async function saveSettings(s: ExtSettings): Promise<void> {
  await browser.storage.local.set({ settings: s });
}
