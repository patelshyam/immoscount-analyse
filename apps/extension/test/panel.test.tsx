import type { StateCode } from '@immo/calc';
import { BUNDLED_REFERENCE, DEFAULT_ASSUMPTIONS } from '@immo/data';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Panel } from '../src/panel/Panel';
import type { ParsedListing } from '../src/parsers/types';

// ponytail: hand-built listing until IS24 fixtures exist; then this renders a parsed fixture.
const LISTING: ParsedListing = {
  source: 'is24',
  externalId: '1',
  url: 'https://www.immobilienscout24.de/expose/1',
  title: 'Golden case',
  propertyType: 'apartment',
  price: 300000,
  livingArea: 75,
  rooms: 3,
  hausgeldMonthly: 300,
  actualColdRentMonthly: 1000,
  brokerFee: 0.0357,
  yearBuilt: null,
  postalCode: null,
  city: 'Darmstadt',
  street: null,
  warnings: [],
};
const CITIES = new Map<string, StateCode>([['darmstadt', 'HE']]);

const renderPanel = (listing = LISTING, collapsed = false, onCollapsedChange = vi.fn()) =>
  render(
    <Panel
      listing={listing}
      assumptions={DEFAULT_ASSUMPTIONS}
      reference={BUNDLED_REFERENCE}
      cityStates={CITIES}
      collapsed={collapsed}
      onCollapsedChange={onCollapsedChange}
    />,
  );

/** Text of the metric tile with this label, whitespace normalized. */
const metric = (label: string) =>
  screen.getByText(label).parentElement?.querySelector('strong')?.textContent?.replace(/\s/g, ' ');

afterEach(cleanup);

describe('Panel', () => {
  it('renders the golden analysis', () => {
    renderPanel();
    expect(screen.getByText('Darmstadt · 3 Zi. · 75 m²')).toBeTruthy();
    expect(screen.getByText('Below target')).toBeTruthy();
    expect(metric('Gross yield')).toBe('4,00 %');
    expect(metric('Net yield')).toBe('2,83 %');
    expect(metric('Cashflow / mo')).toBe('-607 €'); // at 10 % equity
    expect(metric('Price / m²')).toBe('4.000 €');
    expect(screen.getByText('actual')).toBeTruthy();
    expect(screen.getByText(/not financial, tax or investment advice/)).toBeTruthy();
  });

  it('equity switch changes the cashflow', () => {
    renderPanel();
    fireEvent.click(screen.getByRole('button', { name: /^20\s%$/ }));
    expect(metric('Cashflow / mo')).toBe('-469 €');
  });

  it('rent override recalculates live', () => {
    renderPanel();
    fireEvent.change(screen.getByLabelText('Rent override €/mo'), { target: { value: '1.400' } });
    expect(screen.getByText('manual')).toBeTruthy();
    expect(metric('Gross yield')).toBe('5,60 %'); // 16.800 / 300.000
  });

  it('missing rent → unknown verdict, input recovers it', () => {
    renderPanel({ ...LISTING, actualColdRentMonthly: null, city: 'Nowhere' });
    expect(screen.getByText('Unknown')).toBeTruthy();
    expect(screen.getByText('missing')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Rent override €/mo'), { target: { value: '1000' } });
    expect(screen.getByText('Below target')).toBeTruthy();
  });

  it('unknown city → highest tax; picking the state recalculates', () => {
    renderPanel({ ...LISTING, city: 'Nowhere' });
    expect(screen.getByText(/State unknown/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText('State'), { target: { value: 'BY' } });
    expect(screen.queryByText(/State unknown/)).toBeNull();
    expect(screen.getByText(/Grunderwerbsteuer \(3,50\s%\)/)).toBeTruthy();
  });

  it('collapses to a tab', () => {
    const onChange = vi.fn();
    renderPanel(LISTING, false, onChange);
    fireEvent.click(screen.getByTitle('Collapse'));
    expect(onChange).toHaveBeenCalledWith(true);
    renderPanel(LISTING, true);
    expect(screen.getByTitle('Open analysis').textContent?.replace(/\s/g, ' ')).toContain('2,8 %');
  });

  it('missing price → message instead of crash', () => {
    renderPanel({ ...LISTING, price: null, warnings: ['Kaufpreis not found'] });
    expect(screen.getByText(/Couldn.t read price/)).toBeTruthy();
    expect(screen.getByText('Kaufpreis not found')).toBeTruthy();
  });
});
