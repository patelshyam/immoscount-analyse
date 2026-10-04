import type { StateCode } from '@immo/calc';
import { BUNDLED_REFERENCE, DEFAULT_ASSUMPTIONS } from '@immo/data';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { badgeFor, startBadges, type BadgeContext } from '../src/badges';
import type { ParsedCard } from '../src/parsers/types';

const CTX: BadgeContext = {
  source: 'is24',
  assumptions: DEFAULT_ASSUMPTIONS,
  reference: BUNDLED_REFERENCE, // demo placeholder: 10 €/m² in Berlin, Frankfurt am Main, Leipzig
  cityStates: new Map<string, StateCode>([['leipzig', 'SN']]),
  saved: [
    { id: 'p1', source: 'is24', externalId: '111', statusId: 's-view' },
    { id: 'p2', source: 'is24', externalId: '222', statusId: 's-rej' },
  ],
  statuses: [
    { id: 's-view', name: 'Viewing scheduled', color: '#000', kind: 'open' },
    { id: 's-rej', name: 'Rejected', color: '#000', kind: 'excluded' },
  ],
  exclusionKeywords: ['Erbbaurecht', 'Zwangsversteigerung'],
};

const card = (over: Partial<ParsedCard> = {}): ParsedCard => ({
  externalId: '999',
  url: null,
  price: 200_000,
  livingArea: 70,
  rooms: 2,
  city: 'Leipzig',
  title: 'Schöne Wohnung',
  element: document.createElement('div'),
  ...over,
});

describe('badgeFor', () => {
  it('gross yield from the reference rent, labelled est.', () => {
    // 10 €/m² × 70 m² × 12 / 200.000 = 4,2 %
    const b = badgeFor(card(), CTX);
    expect(b.text.replace(/\s/g, ' ')).toBe('est. 4,2 %');
    expect(b.title).toContain('PLACEHOLDER');
    expect(['green', 'orange', 'red']).toContain(b.tone);
  });

  it('no reference for the city → unknown tone', () => {
    expect(badgeFor(card({ city: 'Bonn' }), CTX).tone).toBe('unknown');
  });

  it('missing price/area → unknown, no crash', () => {
    expect(badgeFor(card({ price: null }), CTX)).toMatchObject({ text: 'est. –', tone: 'unknown' });
  });

  it('saved property shows its pipeline status', () => {
    expect(badgeFor(card({ externalId: '111' }), CTX).text).toContain('Viewing scheduled');
  });

  it('saved with an excluded-kind status → Excluded', () => {
    expect(badgeFor(card({ externalId: '222' }), CTX)).toMatchObject({
      tone: 'excluded',
      text: 'Excluded · Rejected',
    });
  });

  it('keyword rule matches the title case-insensitively', () => {
    expect(badgeFor(card({ title: 'Wohnung im ERBBAURECHT' }), CTX)).toMatchObject({
      tone: 'excluded',
      text: 'Excluded · Erbbaurecht',
    });
  });

  it('saved ids from the other portal do not match', () => {
    expect(badgeFor(card({ externalId: '222' }), { ...CTX, source: 'immowelt' }).tone).not.toBe(
      'excluded',
    );
  });
});

describe('startBadges (dynamic results)', () => {
  // Synthetic list markup — only to exercise the observer, not a portal's real DOM.
  const parse = (doc: Document): ParsedCard[] =>
    [...doc.querySelectorAll<HTMLElement>('.card')].map((el) =>
      card({ externalId: el.dataset.id ?? null, element: el }),
    );
  const addCard = (id: string) => {
    const el = document.createElement('div');
    el.className = 'card';
    el.dataset.id = id;
    document.querySelector('#list')!.append(el);
  };
  const badges = () => document.querySelectorAll('.immo-analyzer-badge').length;
  const flush = async () => {
    await Promise.resolve(); // let MutationObserver callbacks run
    await vi.advanceTimersByTimeAsync(300);
  };

  let stop: () => void;
  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = '<div id="list"></div>';
  });
  afterEach(() => {
    stop?.();
    vi.useRealTimers();
  });

  it('badges existing cards immediately and later-loaded cards after the debounce', async () => {
    addCard('1');
    addCard('2');
    stop = startBadges(document, parse, CTX);
    expect(badges()).toBe(2);
    addCard('3');
    addCard('4');
    expect(badges()).toBe(2); // debounced
    await flush();
    expect(badges()).toBe(4);
  });

  it('never badges a card twice across many mutations', async () => {
    addCard('1');
    stop = startBadges(document, parse, CTX);
    for (let i = 0; i < 5; i++) {
      document.querySelector('#list')!.append(document.createElement('span'));
      await flush();
    }
    expect(badges()).toBe(1);
    expect(
      document.querySelectorAll('.card')[0]!.querySelectorAll('.immo-analyzer-badge'),
    ).toHaveLength(1);
  });

  it('stop() disconnects the observer', async () => {
    stop = startBadges(document, parse, CTX);
    stop();
    addCard('9');
    await flush();
    expect(badges()).toBe(0);
  });
});
