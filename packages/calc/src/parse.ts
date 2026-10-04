/**
 * First number in a German-formatted string: "349.000 €" → 349000, "78,5 m²" → 78.5,
 * "1.250,50 €" → 1250.5. Without a comma, dots only count as thousands separators in
 * "1.234.567" form, so "3.5" stays 3.5. Returns null if no number is found.
 */
export function parseGermanNumber(text: string | null | undefined): number | null {
  const token = text
    ?.replace(/[\u00a0\u202f]/g, ' ')
    .match(/-?\d[\d.,\s]*/)?.[0]
    .trim();
  if (!token) return null;
  let s: string;
  if (token.includes(',')) s = token.replace(/[.\s]/g, '').replace(',', '.');
  else if (/^-?\d{1,3}([.\s]\d{3})+$/.test(token)) s = token.replace(/[.\s]/g, '');
  else s = token.replace(/\s/g, '');
  const n = Number.parseFloat(s);
  return Number.isFinite(n) ? n : null;
}
