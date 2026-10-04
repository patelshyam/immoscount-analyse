import type { PropertyType, StateCode } from '@immo/calc';

export type PortalId = 'is24' | 'immowelt';
export type PageType = 'listing_buy' | 'listing_rent' | 'search' | 'other';

/** Every field nullable: a field we can't parse is null + a warning, never a crash. */
export interface ParsedListing {
  source: PortalId;
  externalId: string | null;
  url: string;
  title: string | null;
  propertyType: PropertyType | null;
  price: number | null;
  livingArea: number | null;
  rooms: number | null;
  hausgeldMonthly: number | null;
  actualColdRentMonthly: number | null;
  /** fraction; 0 if provisionsfrei */
  brokerFee: number | null;
  yearBuilt: number | null;
  postalCode: string | null;
  city: string | null;
  /** when the page states it (IS24 does); otherwise resolved from the city */
  state: StateCode | null;
  street: string | null;
  warnings: string[];
}

export interface ParsedCard {
  externalId: string | null;
  url: string | null;
  price: number | null;
  livingArea: number | null;
  rooms: number | null;
  city: string | null;
  title: string | null;
  element: Element;
}

export interface PortalParser {
  id: PortalId;
  matches(url: URL): boolean;
  pageType(doc: Document, url: URL): PageType;
  parseListing(doc: Document, url: URL): ParsedListing;
  parseSearchCards(doc: Document): ParsedCard[];
}
