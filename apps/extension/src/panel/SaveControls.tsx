import { useState } from 'react';
import type { StatusRef } from '../bootstrap';

export interface SaveControlsProps {
  online: boolean;
  /** false when price or area couldn't be parsed */
  canSave: boolean;
  saved: { id: string; statusId: string } | null;
  statuses: StatusRef[];
  appUrl: string;
  onAdd(): Promise<void>;
  onStatusChange(statusId: string): Promise<void>;
  error: string | null;
}

export function SaveControls(p: SaveControlsProps) {
  const [busy, setBusy] = useState(false);
  const run = (fn: () => Promise<void>) => async () => {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="ia-save">
      {p.saved ? (
        <>
          <span className="ia-saved">
            Saved ✓ ·{' '}
            <a href={`${p.appUrl}/properties/${p.saved.id}`} target="_blank" rel="noreferrer">
              Open in app
            </a>
          </span>
          <select
            aria-label="Pipeline status"
            value={p.saved.statusId}
            disabled={busy || !p.online}
            onChange={(e) => void run(() => p.onStatusChange(e.currentTarget.value))()}
          >
            {p.statuses.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </>
      ) : (
        <>
          <button
            className="ia-primary"
            disabled={busy || !p.online || !p.canSave}
            onClick={run(p.onAdd)}
          >
            {busy ? 'Saving…' : 'Add to app'}
          </button>
          {!p.online && <span className="ia-muted">App offline</span>}
          {p.online && !p.canSave && <span className="ia-muted">Price/area missing</span>}
        </>
      )}
      {p.error && <div className="ia-error">{p.error}</div>}
    </div>
  );
}
