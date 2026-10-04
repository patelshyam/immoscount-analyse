import { normalizeCityKey, shortCityKey, type StateCode } from '@immo/calc';
import cityJson from './city-state.json' with { type: 'json' };

export interface CityStateRow {
  cityKey: string;
  displayName: string;
  state: StateCode;
}

export const CITY_SOURCE = { source: cityJson.source, retrievedOn: cityJson.retrievedOn };

/**
 * Full normalized names plus short aliases ("frankfurt", "halle").
 * Any key that would map to more than one state is dropped (e.g. "Senden" BY/NW,
 * "Frankfurt" HE/BB) — the extension asks the user once instead of guessing.
 */
export function buildCityStateMap(cities: { name: string; state: string }[]): CityStateRow[] {
  const byKey = new Map<string, CityStateRow | null>();
  const add = (key: string, row: CityStateRow) => {
    const prev = byKey.get(key);
    if (prev === undefined) byKey.set(key, row);
    else if (prev && prev.state !== row.state) byKey.set(key, null);
  };
  for (const c of cities) {
    add(normalizeCityKey(c.name), {
      cityKey: normalizeCityKey(c.name),
      displayName: c.name,
      state: c.state as StateCode,
    });
  }
  const fullKeys = new Set(byKey.keys());
  for (const c of cities) {
    const short = shortCityKey(c.name);
    if (!fullKeys.has(short)) {
      add(short, { cityKey: short, displayName: c.name, state: c.state as StateCode });
    }
  }
  return [...byKey.values()].filter((r): r is CityStateRow => r !== null);
}

export const CITY_STATE: CityStateRow[] = buildCityStateMap(cityJson.cities);
