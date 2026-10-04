// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BUNDLED_REFERENCE, DEFAULT_ASSUMPTIONS } from '@immo/data';
import { describe, expect, it, vi } from 'vitest';
import { startBadges, type BadgeContext } from '../src/badges';
import { parserFor } from '../src/parsers';
import { immowelt } from '../src/parsers/immowelt';
import { is24 } from '../src/parsers/is24';

const load = (portal: string, name: string) =>
  new DOMParser().parseFromString(
    readFileSync(join(import.meta.dirname, 'fixtures', portal, name), 'utf8'),
    'text/html',
  );

describe('IS24 search-1.html', () => {
  const doc = load('is24', 'search-1.html');
  const url = new URL(
    'https://www.immobilienscout24.de/Suche/de/hessen/main-kinzig-kreis/schoeneck/haus-kaufen',
  );
  const cards = is24.parseSearchCards(doc);

  it('is a search page with 20 unique cards', () => {
    expect(is24.pageType(doc, url)).toBe('search');
    expect(cards).toHaveLength(20);
    expect(new Set(cards.map((c) => c.externalId)).size).toBe(20);
  });

  it('parses card values (living area, not plot)', () => {
    expect(cards[0]).toMatchObject({
      externalId: '170025543',
      url: 'https://www.immobilienscout24.de/expose/170025543',
      price: 679000,
      livingArea: 238,
      rooms: 8,
      city: 'Schöneck',
    });
    expect(cards[0]!.title).toMatch(/^Charmantes 1 - bis 2- Familienhaus/);
    expect(cards[2]).toMatchObject({ externalId: '171253364', price: 400000, livingArea: 148.91, rooms: 3, city: 'Schöneck' }); // prettier-ignore
    expect(cards[6]).toMatchObject({ externalId: '167677499', rooms: 6.5, livingArea: 150 });
  });

  it('every card has id, price, area, rooms and city', () => {
    for (const c of cards) {
      expect(c.externalId).toMatch(/^\d+$/);
      expect(c.price).toBeGreaterThan(0);
      expect(c.livingArea).toBeGreaterThan(0);
      expect(c.rooms).toBeGreaterThan(0);
      expect(c.city).toBe('Schöneck');
    }
  });
});

describe('Immowelt listing-buy-1.html', () => {
  const doc = load('immowelt', 'listing-buy-1.html');
  const url = new URL('https://www.immowelt.de/expose/419db20f-46d5-4faa-9878-a1e557920881');

  it('is routed to the Immowelt parser as a purchase listing', () => {
    expect(parserFor(url)).toBe(immowelt);
    expect(immowelt.pageType(doc, url)).toBe('listing_buy');
  });

  it('parses all fields', () => {
    const { warnings, brokerFee, ...rest } = immowelt.parseListing(doc, url);
    expect(rest).toEqual({
      source: 'immowelt',
      externalId: '419db20f-46d5-4faa-9878-a1e557920881',
      url: 'https://www.immowelt.de/expose/419db20f-46d5-4faa-9878-a1e557920881',
      title:
        'Perfekt geschnitten: Top-Geschoss-Wohnung mit Balkon, Fahrstuhl und Stellplatz in Neu-Isenburg',
      propertyType: 'apartment',
      price: 153000,
      livingArea: 60,
      rooms: 2,
      hausgeldMonthly: null,
      actualColdRentMonthly: null,
      yearBuilt: 1977,
      postalCode: '63263',
      city: 'Neu-Isenburg',
      state: 'HE',
      street: null,
    });
    expect(brokerFee).toBeCloseTo(0.0299, 10);
    expect(warnings).toEqual([
      'Listed as vermietet, but no rent amount is shown — enter the current rent.',
    ]);
  });

  it('page without server state: nulls + warning, no crash', () => {
    const empty = new DOMParser().parseFromString('<html><body></body></html>', 'text/html');
    expect(immowelt.pageType(empty, url)).toBe('other');
    const r = immowelt.parseListing(empty, url);
    expect(r).toMatchObject({ externalId: '419db20f-46d5-4faa-9878-a1e557920881', price: null });
    expect(r.warnings[0]).toContain('page data not found');
  });
});

describe('Immowelt search-1.html', () => {
  const doc = load('immowelt', 'search-1.html');
  const url = new URL(
    'https://www.immowelt.de/classified-search?distributionTypes=Buy&locations=AD08DE2647',
  );
  const cards = immowelt.parseSearchCards(doc);

  it('is a search page with 40 unique cards', () => {
    expect(immowelt.pageType(doc, url)).toBe('search');
    expect(cards).toHaveLength(40);
    expect(new Set(cards.map((c) => c.externalId)).size).toBe(40);
  });

  it('parses card values (living area, not Grundstück)', () => {
    expect(cards[0]).toMatchObject({
      externalId: 'd78aff0e-db36-4f98-af3c-a00a1cbd72da',
      url: 'https://www.immowelt.de/expose/d78aff0e-db36-4f98-af3c-a00a1cbd72da',
      price: 725000,
      livingArea: 135,
      rooms: 7,
      city: 'Neu-Isenburg',
    });
    expect(cards[0]!.title).toMatch(/^Einfamilienhaus zum Kauf/);
    expect(cards[2]).toMatchObject({ externalId: '0634505c-4b95-4aba-94a6-3ecf9198e8f3', livingArea: 110, rooms: 4 }); // prettier-ignore
    expect(cards[10]).toMatchObject({ rooms: 6.5, livingArea: 255.6 });
    // the saved listing fixture appears in the results
    expect(cards.some((c) => c.externalId === '419db20f-46d5-4faa-9878-a1e557920881')).toBe(true);
  });

  it('every card has id, price and city', () => {
    for (const c of cards) {
      expect(c.externalId).toMatch(/^[0-9a-f-]{36}$/);
      expect(c.price).toBeGreaterThan(0);
      expect(c.city).toBe('Neu-Isenburg');
    }
  });
});

describe('badges on the real search fixtures', () => {
  const ctx = (source: 'is24' | 'immowelt'): BadgeContext => ({
    source,
    assumptions: DEFAULT_ASSUMPTIONS,
    reference: BUNDLED_REFERENCE,
    cityStates: new Map(),
    saved: [{ id: 'p', source: 'immowelt', externalId: '419db20f-46d5-4faa-9878-a1e557920881', statusId: 'x' }], // prettier-ignore
    statuses: [{ id: 'x', name: 'Rejected', color: '#000', kind: 'excluded' }],
    exclusionKeywords: ['Bieterverfahren'],
  });

  it.each([
    ['is24', 'search-1.html', is24, 20],
    ['immowelt', 'search-1.html', immowelt, 40],
  ] as const)('%s: one badge per card, idempotent', async (portal, file, parser, n) => {
    vi.useFakeTimers();
    const doc = load(portal, file);
    const stop = startBadges(doc, (d) => parser.parseSearchCards(d), ctx(portal));
    expect(doc.querySelectorAll('.immo-analyzer-badge')).toHaveLength(n);
    doc.body.append(doc.createElement('div')); // unrelated mutation → re-scan
    await vi.advanceTimersByTimeAsync(300);
    expect(doc.querySelectorAll('.immo-analyzer-badge')).toHaveLength(n);
    stop();
    vi.useRealTimers();
  });

  it('marks the saved+excluded Immowelt listing', () => {
    const doc = load('immowelt', 'search-1.html');
    const stop = startBadges(doc, (d) => immowelt.parseSearchCards(d), ctx('immowelt'));
    const card = immowelt.parseSearchCards(doc).find((c) => c.externalId === '419db20f-46d5-4faa-9878-a1e557920881')!; // prettier-ignore
    const pill = card.element.querySelector('.immo-analyzer-badge')!.shadowRoot!.textContent;
    expect(pill).toBe('Excluded · Rejected');
    stop();
  });

  it('keyword rule hits the IS24 "Bieterverfahren" card', () => {
    const doc = load('is24', 'search-1.html');
    const stop = startBadges(doc, (d) => is24.parseSearchCards(d), ctx('is24'));
    const card = is24.parseSearchCards(doc).find((c) => c.externalId === '169446028')!;
    expect(card.element.querySelector('.immo-analyzer-badge')!.shadowRoot!.textContent).toBe(
      'Excluded · Bieterverfahren',
    );
    stop();
  });
});
