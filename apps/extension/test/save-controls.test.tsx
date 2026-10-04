import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SaveControls, type SaveControlsProps } from '../src/panel/SaveControls';

const STATUSES = [
  { id: 's1', name: 'New', color: '#000', kind: 'open' as const },
  { id: 's2', name: 'Viewing scheduled', color: '#000', kind: 'open' as const },
];
const base: SaveControlsProps = {
  online: true,
  canSave: true,
  saved: null,
  statuses: STATUSES,
  appUrl: 'http://127.0.0.1:3001',
  onAdd: vi.fn(async () => {}),
  onStatusChange: vi.fn(async () => {}),
  error: null,
};

afterEach(cleanup);

describe('SaveControls', () => {
  it('Add to app calls onAdd', () => {
    const onAdd = vi.fn(async () => {});
    render(<SaveControls {...base} onAdd={onAdd} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add to app' }));
    expect(onAdd).toHaveBeenCalledOnce();
  });

  it('offline → disabled with hint', () => {
    render(<SaveControls {...base} online={false} />);
    expect((screen.getByRole('button', { name: 'Add to app' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    expect(screen.getByText('App offline')).toBeTruthy();
  });

  it('missing price/area → disabled with hint', () => {
    render(<SaveControls {...base} canSave={false} />);
    expect((screen.getByRole('button', { name: 'Add to app' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    expect(screen.getByText('Price/area missing')).toBeTruthy();
  });

  it('saved → link into the app and status dropdown', () => {
    const onStatusChange = vi.fn(async () => {});
    render(
      <SaveControls
        {...base}
        saved={{ id: 'p1', statusId: 's1' }}
        onStatusChange={onStatusChange}
      />,
    );
    expect(screen.getByText('Open in app').getAttribute('href')).toBe(
      'http://127.0.0.1:3001/properties/p1',
    );
    expect(screen.queryByRole('button', { name: 'Add to app' })).toBeNull();
    fireEvent.change(screen.getByLabelText('Pipeline status'), { target: { value: 's2' } });
    expect(onStatusChange).toHaveBeenCalledWith('s2');
  });
});
