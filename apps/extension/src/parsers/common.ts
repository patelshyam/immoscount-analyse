import { parseGermanNumber } from '@immo/calc';

export { parseGermanNumber };

/** All JSON-LD objects on the page, flattened (arrays and @graph). Bad JSON is skipped. */
export function readJsonLd(doc: Document): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  const visit = (x: unknown) => {
    if (Array.isArray(x)) x.forEach(visit);
    else if (x && typeof x === 'object') {
      out.push(x as Record<string, unknown>);
      const graph = (x as Record<string, unknown>)['@graph'];
      if (graph) visit(graph);
    }
  };
  for (const s of doc.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      visit(JSON.parse(s.textContent ?? ''));
    } catch {
      // ignore malformed blocks
    }
  }
  return out;
}

/** Broker fee from free text: "provisionsfrei" → 0, "3,57 % inkl. MwSt." → 0.0357, else null. */
export function parseBrokerFee(text: string | null | undefined): number | null {
  if (!text) return null;
  if (/provisionsfrei|keine\s+(käufer)?provision/i.test(text)) return 0;
  const m = text.match(/(\d+(?:[.,]\d+)?)\s*%/);
  if (!m?.[1]) return null;
  const pct = parseGermanNumber(m[1]);
  return pct == null ? null : pct / 100;
}

export const cleanText = (s: string | null | undefined) => s?.replace(/\s+/g, ' ').trim() || null;
