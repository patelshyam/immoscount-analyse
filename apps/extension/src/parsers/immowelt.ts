import type { PropertyType, StateCode } from '@immo/calc';
import { STATE_NAMES } from '@immo/data';
import { cleanText, parseBrokerFee, parseGermanNumber } from './common';
import type { ParsedCard, ParsedListing, PortalParser } from './types';

/*
 * Derived from test/fixtures/immowelt/{listing-buy-1,search-1}.html (2026-10-04).
 * Listing: the server state in <script id="__UFRN_LIFECYCLE_SERVERREQUEST__">
 *   window[...] = JSON.parse("<json string>")  →  .app_demand_referral_cldp.data.classified
 * Search: cards [data-testid="serp-core-classified-card-testid"] with price aria-label,
 *   keyfacts ("3 Zimmer", "70 m²", "185 m² Grundstück") and address "…, City (PLZ)".
 */

const STATE_BY_NAME = new Map(
  Object.entries(STATE_NAMES).map(([code, name]) => [name.toLowerCase(), code as StateCode]),
);

const EXPOSE_RE = /^\/expose\/([0-9a-zA-Z-]+)/;

type Json = Record<string, unknown>;
const obj = (x: unknown): Json => (x && typeof x === 'object' ? (x as Json) : {});
const arr = (x: unknown): Json[] => (Array.isArray(x) ? (x as Json[]) : []);
const str = (x: unknown) => (typeof x === 'string' && x.trim() ? x.trim() : null);

/** The listing object, or null if the page has no (parsable) server state. */
function readClassified(doc: Document): Json | null {
  const text = doc.getElementById('__UFRN_LIFECYCLE_SERVERREQUEST__')?.textContent ?? '';
  const m = text.match(/JSON\.parse\(("(?:[^"\\]|\\.)*")\)/);
  if (!m?.[1]) return null;
  try {
    const state = JSON.parse(JSON.parse(m[1]) as string) as Json;
    for (const app of Object.values(state)) {
      const c = obj(obj(obj(app).data).classified);
      if (c.id) return c;
    }
  } catch {
    // malformed state → DOM-less fallback below
  }
  return null;
}

const PROPERTY_TYPES: Record<string, PropertyType> = { APARTMENT: 'apartment', HOUSE: 'house' };

function parseListing(doc: Document, url: URL): ParsedListing {
  const warnings: string[] = [];
  const c = readClassified(doc);
  if (!c) warnings.push('Immowelt page data not found — fields could not be read.');
  const sections = obj(c?.sections);
  const hardFacts = obj(sections.hardFacts);
  const fact = (type: string) => str(arr(hardFacts.facts).find((f) => f.type === type)?.splitValue);
  const address = obj(obj(sections.location).address);
  const tracking = obj(obj(c?.advertising).tracking_config);
  const avItem = arr(obj(c?.tracking).av_items)[0] ?? {};
  const raw = obj(c?.rawData);

  const need = <T>(label: string, v: T | null): T | null => {
    if (v == null && c) warnings.push(`${label} not found on the page.`);
    return v;
  };

  const price = need(
    'Kaufpreis',
    typeof avItem.price === 'number'
      ? avItem.price
      : parseGermanNumber(str(obj(hardFacts.price).value)),
  );
  const livingArea = need('Wohnfläche', parseGermanNumber(fact('livingSpace')));
  const rooms = parseGermanNumber(fact('numberOfRooms'));

  const propertyType = PROPERTY_TYPES[String(raw.propertyType)] ?? null;
  if (c && !propertyType) warnings.push('Property type not recognised — assuming apartment.');

  const commission = str(obj(obj(obj(sections.price).base).commissionFee).value);
  const brokerFee = parseBrokerFee(commission);
  if (c && brokerFee == null) warnings.push('Broker fee not found — using the default.');

  const rented = arr(obj(sections.features).preview).some((f) => f.icon === 'rented');
  if (rented)
    warnings.push('Listed as vermietet, but no rent amount is shown — enter the current rent.');

  const year = arr(obj(sections.energy).features).find((f) => f.type === 'yearOfConstruction');
  const stateName = str(tracking.Bundesland) ?? str(obj(sections.mortgage).region);
  const canonical = doc.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href;

  return {
    source: 'immowelt',
    externalId: str(obj(c?.metadata).legacyId) ?? url.pathname.match(EXPOSE_RE)?.[1] ?? null,
    url: canonical || `${url.origin}${url.pathname}`,
    title: str(obj(sections.mainDescription).headline) ?? cleanText(doc.title),
    propertyType,
    price,
    livingArea,
    rooms,
    // Hausgeld / rent amounts: not present in the fixture → not parsed (no guessed paths).
    hausgeldMonthly: null,
    actualColdRentMonthly: null,
    brokerFee,
    yearBuilt: parseGermanNumber(str(year?.value)),
    postalCode: str(address.zipCode),
    city: str(address.city),
    state: stateName ? (STATE_BY_NAME.get(stateName.toLowerCase()) ?? null) : null,
    street: str(address.street),
    warnings,
  };
}

const testId = (el: Element, id: string) => el.querySelector(`[data-testid="${id}"]`);

function parseSearchCards(doc: Document): ParsedCard[] {
  return [...doc.querySelectorAll('[data-testid="serp-core-classified-card-testid"]')].map(
    (element) => {
      const link = element.querySelector<HTMLAnchorElement>('a[href*="/expose/"]');
      const href = link?.getAttribute('href') ?? null;
      const facts = [...(testId(element, 'cardmfe-keyfacts-testid')?.children ?? [])].map(
        (d) => cleanText(d.textContent) ?? '',
      );
      const address = cleanText(testId(element, 'cardmfe-description-box-address')?.textContent);
      const lastPart = address?.split(',').at(-1)?.trim() ?? null;
      return {
        externalId: href ? (new URL(href, 'https://www.immowelt.de').pathname.match(EXPOSE_RE)?.[1] ?? null) : null, // prettier-ignore
        url: href ? href.split(/[?#]/)[0]! : null,
        price: parseGermanNumber(
          testId(element, 'cardmfe-price-testid')?.getAttribute('aria-label'),
        ),
        livingArea: parseGermanNumber(
          facts.find((f) => f.includes('m²') && !/Grundstück/i.test(f)),
        ),
        rooms: parseGermanNumber(facts.find((f) => /Zimmer/i.test(f))),
        city: lastPart?.replace(/\s*\(\d{5}\)$/, '') || null,
        title: cleanText(link?.getAttribute('title')),
        element,
      };
    },
  );
}

export const immowelt: PortalParser = {
  id: 'immowelt',

  matches: (url) => url.hostname === 'www.immowelt.de',

  pageType(doc, url) {
    if (url.pathname.startsWith('/classified-search') || url.pathname.startsWith('/suche/')) {
      return 'search';
    }
    if (!EXPOSE_RE.test(url.pathname)) return 'other';
    const type = obj(readClassified(doc)?.rawData).distributionType;
    if (type === 'BUY') return 'listing_buy';
    if (type === 'RENT') return 'listing_rent';
    return 'other';
  },

  parseListing,
  parseSearchCards,
};
