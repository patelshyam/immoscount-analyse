import type { PropertyType, StateCode } from '@immo/calc';
import { STATE_NAMES } from '@immo/data';
import { cleanText, labelValue, parseBrokerFee, parseGermanNumber, readJsonLd } from './common';
import type { ParsedCard, ParsedListing, PortalParser } from './types';

/*
 * Derived from test/fixtures/is24/listing-buy-*.html (2026-10-04). Order per SPEC §6.3:
 *  1. `var keyValues = {"obj_purchasePrice":"479000", …}` (tracking data, plain JSON) + JSON-LD
 *  2. `.is24qa-*` classes on the <dd> value cells
 *  3. <dt>label</dt><dd>value</dd> text ("Hausgeld", …)
 */

type KeyValues = Record<string, string | null>;

const STATE_BY_NAME = new Map(
  Object.entries(STATE_NAMES).map(([code, name]) => [name.toLowerCase(), code as StateCode]),
);

function readKeyValues(doc: Document): KeyValues {
  for (const s of doc.querySelectorAll('script:not([src])')) {
    const m = s.textContent?.match(/var keyValues\s*=\s*(\{[^\n]*\});/);
    if (!m?.[1]) continue;
    try {
      return JSON.parse(m[1]) as KeyValues;
    } catch {
      return {};
    }
  }
  return {};
}

/** keyValues use "no_information" for blanks and dot decimals ("287.73"). */
const kv = (k: KeyValues, key: string) => {
  const v = k[key];
  return v == null || v === '' || v === 'no_information' ? null : v;
};
const kvNumber = (k: KeyValues, key: string) => {
  const v = kv(k, key);
  const n = v == null ? NaN : Number(v);
  return Number.isFinite(n) ? n : null;
};
const qa = (doc: Document, cls: string) =>
  cleanText(doc.querySelector(`.is24qa-${cls}`)?.textContent);

function propertyTypeOf(k: KeyValues): PropertyType | null {
  const immotype = kv(k, 'obj_immotype') ?? '';
  if (immotype.startsWith('haus')) {
    return kv(k, 'obj_buildingType') === 'multi_family_house' ? 'multi_family' : 'house';
  }
  // ponytail: apartment value unverified — no apartment fixture yet; add one and pin it in a test.
  if (immotype.startsWith('wohnung')) return 'apartment';
  return null;
}

const EXPOSE_RE = /^\/expose\/(\d+)/;

export const is24: PortalParser = {
  id: 'is24',

  matches: (url) => url.hostname === 'www.immobilienscout24.de',

  pageType(doc, url) {
    if (url.pathname.startsWith('/Suche/')) return 'search';
    if (!EXPOSE_RE.test(url.pathname)) return 'other';
    const immotype = readKeyValues(doc).obj_immotype ?? '';
    if (immotype.endsWith('_kauf')) return 'listing_buy';
    if (immotype.endsWith('_miete')) return 'listing_rent';
    // Fallback: a purchase price cell only exists on Kauf exposés.
    return doc.querySelector('.is24qa-kaufpreis') ? 'listing_buy' : 'other';
  },

  parseListing(doc, url): ParsedListing {
    const warnings: string[] = [];
    const k = readKeyValues(doc);
    const ld = readJsonLd(doc).find((x) => x['@type'] === 'RealEstateListing');
    const ldOffer = ld?.offers as { price?: string } | undefined;

    const need = <T>(label: string, v: T | null): T | null => {
      if (v == null) warnings.push(`${label} not found on the page.`);
      return v;
    };

    const price = need(
      'Kaufpreis',
      kvNumber(k, 'obj_purchasePrice') ??
        (ldOffer?.price ? Number(ldOffer.price) || null : null) ??
        parseGermanNumber(qa(doc, 'kaufpreis')),
    );
    const livingArea = need(
      'Wohnfläche',
      kvNumber(k, 'obj_livingSpace') ?? parseGermanNumber(qa(doc, 'wohnflaeche-ca')),
    );
    const rooms = kvNumber(k, 'obj_noRooms') ?? parseGermanNumber(qa(doc, 'zimmer'));

    const propertyType = propertyTypeOf(k);
    if (!propertyType) warnings.push('Property type not recognised — assuming apartment.');

    const hausgeldText = labelValue(doc, /^Hausgeld\b/i);
    const hausgeldMonthly = parseGermanNumber(hausgeldText);

    // "Mieteinnahmen pro Monat" = current rental income (can be partial, e.g. one unit vacant).
    const rentText = qa(doc, 'mieteinnahmen-pro-monat') ?? labelValue(doc, /^Mieteinnahmen/i);
    const actualColdRentMonthly = parseGermanNumber(rentText);
    if (actualColdRentMonthly != null && kv(k, 'obj_rented') === 'n') {
      warnings.push('Rental income shown although not marked as let — possibly only partly let.');
    }

    const brokerText = qa(doc, 'provision') ?? labelValue(doc, /^Provision/i);
    let brokerFee = parseBrokerFee(brokerText);
    if (brokerFee == null && kv(k, 'obj_courtage') === 'n') brokerFee = 0;
    if (brokerFee == null) warnings.push('Broker fee not found — using the default.');

    const regio1 = kv(k, 'obj_regio1');
    const canonical = doc.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href;

    return {
      source: 'is24',
      externalId: kv(k, 'obj_scoutId') ?? url.pathname.match(EXPOSE_RE)?.[1] ?? null,
      url: canonical || `${url.origin}${url.pathname}`,
      title: cleanText(ld?.name as string | undefined) ?? cleanText(doc.title),
      propertyType,
      price,
      livingArea,
      rooms,
      hausgeldMonthly,
      actualColdRentMonthly,
      brokerFee,
      yearBuilt: kvNumber(k, 'obj_yearConstructed') ?? parseGermanNumber(qa(doc, 'baujahr')),
      postalCode: kv(k, 'obj_zipCode'),
      city: kv(k, 'obj_regio3'),
      state: regio1 ? (STATE_BY_NAME.get(regio1.toLowerCase()) ?? null) : null,
      street: kv(k, 'obj_streetPlain'),
      warnings,
    };
  },

  /*
   * From test/fixtures/is24/search-1.html: cards are div[data-obid]; values are unlabeled
   * <dd>s in [data-testid=attributes] ("679.000 €", "238 m²", "8 Zi.", then plot "350 m²");
   * address is "[Street, ]City, Kreis".
   */
  parseSearchCards(doc): ParsedCard[] {
    return [...doc.querySelectorAll<HTMLElement>('[data-obid]')].map((element) => {
      const id = element.dataset.obid || null;
      const dds = [...element.querySelectorAll('[data-testid="attributes"] dd')].map(
        (d) => cleanText(d.textContent) ?? '',
      );
      const parts = cleanText(
        element.querySelector('[data-testid="hybridViewAddress"]')?.textContent,
      )
        ?.split(',')
        .map((x) => x.trim());
      return {
        externalId: id,
        url: id ? `https://www.immobilienscout24.de/expose/${id}` : null,
        price: parseGermanNumber(dds.find((d) => d.includes('€'))),
        livingArea: parseGermanNumber(dds.find((d) => d.includes('m²'))), // first m² = Wohnfläche
        rooms: parseGermanNumber(dds.find((d) => /Zi\b/.test(d))),
        city: parts ? (parts.length >= 2 ? parts.at(-2)! : parts[0]!) || null : null,
        title: cleanText(element.querySelector('[data-testid="headline"]')?.textContent),
        element,
      };
    });
  },
};
