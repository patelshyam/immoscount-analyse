import type { StateCode } from '@immo/calc';
import { browser } from 'wxt/browser';
import type { ApiResult, Message } from './api';
import type { BootstrapResult } from './bootstrap';
import type { ParsedListing } from './parsers/types';

export const send = <T>(msg: Message): Promise<T> => browser.runtime.sendMessage(msg);

export const api = <T>(path: string, method = 'GET', body?: unknown) =>
  send<ApiResult<T>>({ type: 'api', path, method, body });

export const bootstrap = (force = false) => send<BootstrapResult>({ type: 'bootstrap', force });

/** Body for POST /api/properties; null when the listing lacks price or area. */
export function listingPayload(l: ParsedListing, state: StateCode | null) {
  if (l.price == null || l.livingArea == null) return null;
  return {
    source: l.source,
    externalId: l.externalId,
    url: l.url,
    title: l.title,
    propertyType: l.propertyType ?? 'apartment',
    street: l.street,
    postalCode: l.postalCode,
    city: l.city,
    state,
    price: l.price,
    livingArea: l.livingArea,
    rooms: l.rooms,
    hausgeldMonthly: l.hausgeldMonthly,
    actualColdRentMonthly: l.actualColdRentMonthly,
    brokerFeeOverride: l.brokerFee,
    yearBuilt: l.yearBuilt,
  };
}
