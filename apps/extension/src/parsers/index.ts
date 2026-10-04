import { immowelt } from './immowelt';
import { is24 } from './is24';
import type { PortalParser } from './types';

// Portal parsers are added only once their HTML fixtures exist (SPEC §6.3).
export const PARSERS: PortalParser[] = [is24, immowelt];

export const parserFor = (url: URL) => PARSERS.find((p) => p.matches(url)) ?? null;
