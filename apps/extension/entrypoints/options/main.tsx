import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { browser } from 'wxt/browser';
import type { ConnectionResult } from '@/src/api';
import { DEFAULT_SETTINGS, getSettings, saveSettings, type ExtSettings } from '@/src/settings';
import './options.css';

function Options() {
  const [s, setS] = useState<ExtSettings | null>(null);
  const [status, setStatus] = useState('');

  useEffect(() => {
    void getSettings().then(setS);
  }, []);
  if (!s) return null;

  const set = <K extends keyof ExtSettings>(k: K, v: ExtSettings[K]) => setS({ ...s, [k]: v });

  async function save() {
    await saveSettings({ ...s!, apiBaseUrl: s!.apiBaseUrl.replace(/\/+$/, '') });
    setStatus('Saved.');
  }

  async function test() {
    await save();
    setStatus('Testing…');
    const r: ConnectionResult = await browser.runtime.sendMessage({ type: 'testConnection' });
    setStatus(
      !r.reachable
        ? '✗ App not reachable at this URL.'
        : r.authorized
          ? '✓ Connected and token accepted.'
          : '✗ App reachable, but the token was rejected.',
    );
  }

  return (
    <main>
      <h1>immo-analyzer</h1>
      <section>
        <h2>App connection</h2>
        <label>
          API base URL
          <input value={s.apiBaseUrl} onChange={(e) => set('apiBaseUrl', e.target.value)} />
        </label>
        <label>
          API token <small>(copy from the app&apos;s Settings page)</small>
          <input
            type="password"
            value={s.apiToken}
            onChange={(e) => set('apiToken', e.target.value.trim())}
          />
        </label>
        <button onClick={test}>Test connection</button>
      </section>

      <section>
        <h2>Portals</h2>
        {(
          [
            ['enableIs24', 'ImmoScout24'],
            ['enableImmowelt', 'Immowelt'],
            ['enableBadges', 'Badges on search results'],
          ] as const
        ).map(([k, label]) => (
          <label key={k} className="row">
            <input type="checkbox" checked={s[k]} onChange={(e) => set(k, e.target.checked)} />
            {label}
          </label>
        ))}
      </section>

      <section>
        <h2>Exclusion keywords</h2>
        <p>
          <small>
            One per line. Search results whose title contains one are marked “Excluded”.
          </small>
        </p>
        <textarea
          rows={7}
          value={s.exclusionKeywords.join('\n')}
          onChange={(e) => set('exclusionKeywords', e.target.value.split('\n'))}
        />
        <button
          className="secondary"
          onClick={() => set('exclusionKeywords', DEFAULT_SETTINGS.exclusionKeywords)}
        >
          Reset keywords
        </button>
      </section>

      <div className="actions">
        <button
          onClick={() =>
            void saveSettings({
              ...s,
              exclusionKeywords: s.exclusionKeywords.map((x) => x.trim()).filter(Boolean),
            }).then(() => setStatus('Saved.'))
          }
        >
          Save
        </button>
        <span>{status}</span>
      </div>
      <p className="disclaimer">Estimates only — not financial, tax or investment advice.</p>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(<Options />);
