/** "Halle (Saale)" → "halle saale", "Düsseldorf" → "duesseldorf", "St. Ingbert" → "st ingbert" */
export function normalizeCityKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Short form without qualifier: "Frankfurt am Main" → "frankfurt", "Halle (Saale)" → "halle". */
export function shortCityKey(name: string): string {
  return normalizeCityKey(
    name
      .replace(/\s*\(.*\)\s*$/, '')
      .replace(/\s+(am|an der|an den|im|in der|in|ob der|bei|auf der)\s.*$/i, ''),
  );
}
