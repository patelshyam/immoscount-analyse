// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BUNDLED_REFERENCE, DEFAULT_ASSUMPTIONS } from '@immo/data';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Panel } from '../src/panel/Panel';
import { parserFor } from '../src/parsers';
import { is24 } from '../src/parsers/is24';

const FIXTURES = join(import.meta.dirname, 'fixtures', 'is24');
const load = (name: string) =>
  new DOMParser().parseFromString(readFileSync(join(FIXTURES, name), 'utf8'), 'text/html');

/** Drop the embedded tracking JSON and JSON-LD so only DOM strategies remain. */
const domOnly = (doc: Document) => {
  for (const s of doc.querySelectorAll('script')) {
    if (s.type === 'application/ld+json' || s.textContent?.includes('var keyValues')) s.remove();
  }
  return doc;
};

const CASES = [
  {
    file: 'listing-buy-1.html',
    url: 'https://www.immobilienscout24.de/expose/169496867',
    expected: {
      source: 'is24',
      externalId: '169496867',
      url: 'https://www.immobilienscout24.de/expose/169496867',
      title: 'Gepflegtes Mehrfamilienhaus in Kaichen!',
      propertyType: 'multi_family',
      price: 479000,
      livingArea: 300,
      rooms: 10,
      hausgeldMonthly: null,
      actualColdRentMonthly: 946.85,
      brokerFee: 0.0595,
      yearBuilt: 1982,
      postalCode: '61194',
      city: 'Niddatal',
      state: 'HE',
      street: null,
    },
  },
  {
    file: 'listing-buy-2.html',
    url: 'https://www.immobilienscout24.de/expose/169446028?referrer=RESULT_LIST',
    expected: {
      source: 'is24',
      externalId: '169446028',
      url: 'https://www.immobilienscout24.de/expose/169446028',
      title: 'Im privaten Bieterverfahren: Zweifamilienhaus mit Einliegerwohnung in Schöneck',
      propertyType: 'multi_family',
      price: 450000,
      livingArea: 287.73,
      rooms: 7,
      hausgeldMonthly: null,
      actualColdRentMonthly: null,
      brokerFee: 0.0357,
      yearBuilt: 1910,
      postalCode: '61137',
      city: 'Schöneck',
      state: 'HE',
      street: null,
    },
  },
] as const;

afterEach(cleanup);

describe.each(CASES)('IS24 $file', ({ file, url, expected }) => {
  const doc = load(file);
  const u = new URL(url);

  it('is routed to the IS24 parser as a purchase listing', () => {
    expect(parserFor(u)).toBe(is24);
    expect(is24.pageType(doc, u)).toBe('listing_buy');
  });

  it('parses all fields', () => {
    const { warnings, brokerFee, ...rest } = is24.parseListing(doc, u);
    const { brokerFee: expectedFee, ...expectedRest } = expected;
    expect(rest).toEqual(expectedRest);
    expect(brokerFee).toBeCloseTo(expectedFee, 10);
    expect(warnings.every((w) => !w.includes('not found'))).toBe(true);
  });

  it('DOM-only fallback gives the same price, area, rooms, rent, fee, year', () => {
    const r = is24.parseListing(domOnly(load(file)), u);
    expect(r.price).toBe(expected.price);
    expect(r.livingArea).toBe(expected.livingArea);
    expect(r.rooms).toBe(expected.rooms);
    expect(r.actualColdRentMonthly).toBe(expected.actualColdRentMonthly);
    expect(r.brokerFee).toBeCloseTo(expected.brokerFee, 10);
    expect(r.yearBuilt).toBe(expected.yearBuilt);
    expect(r.externalId).toBe(expected.externalId);
  });
});

describe('IS24 robustness', () => {
  it('flags partial letting on listing 1', () => {
    const r = is24.parseListing(load('listing-buy-1.html'), new URL(CASES[0].url));
    expect(r.warnings.some((w) => w.includes('partly let'))).toBe(true);
  });

  it('empty page: nulls + warnings, no crash', () => {
    const doc = new DOMParser().parseFromString('<html><body></body></html>', 'text/html');
    const u = new URL('https://www.immobilienscout24.de/expose/1');
    expect(is24.pageType(doc, u)).toBe('other');
    const r = is24.parseListing(doc, u);
    expect(r).toMatchObject({ externalId: '1', price: null, livingArea: null, city: null });
    expect(r.warnings.length).toBeGreaterThan(0);
  });

  it('routes search and non-portal URLs', () => {
    const doc = document.implementation.createHTMLDocument();
    expect(is24.pageType(doc, new URL('https://www.immobilienscout24.de/Suche/de/hessen/haus-kaufen'))).toBe('search'); // prettier-ignore
    expect(is24.pageType(doc, new URL('https://www.immobilienscout24.de/'))).toBe('other');
    expect(parserFor(new URL('https://example.com/expose/1'))).toBeNull();
  });
});

describe('Panel with a parsed fixture', () => {
  it('renders listing 1 with actual rent and the page state', () => {
    const listing = is24.parseListing(load('listing-buy-1.html'), new URL(CASES[0].url));
    render(
      <Panel
        listing={listing}
        assumptions={DEFAULT_ASSUMPTIONS}
        reference={BUNDLED_REFERENCE}
        cityStates={new Map()}
        collapsed={false}
        onCollapsedChange={() => {}}
      />,
    );
    expect(screen.getByText('Niddatal · 10 Zi. · 300 m²')).toBeTruthy();
    expect(screen.getByText('actual')).toBeTruthy();
    // 946,85 × 12 / 479.000 = 2,37 %
    const gross = screen.getByText('Gross yield').parentElement?.querySelector('strong');
    expect(gross?.textContent?.replace(/\s/g, ' ')).toBe('2,37 %');
    expect(screen.getByText(/Grunderwerbsteuer \(6,00\s%\)/)).toBeTruthy();
    expect(screen.queryByText(/State unknown/)).toBeNull();
  });
});
