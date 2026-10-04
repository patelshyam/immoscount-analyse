import {
  analyze,
  fmtPct,
  normalizeCityKey,
  type Assumptions,
  type ReferenceData,
  type StateCode,
  type Verdict,
} from '@immo/calc';
import type { SavedRef, StatusRef } from './bootstrap';
import type { ParsedCard, PortalId } from './parsers/types';

export interface BadgeContext {
  source: PortalId;
  assumptions: Assumptions;
  reference: ReferenceData;
  cityStates: ReadonlyMap<string, StateCode>;
  saved: SavedRef[];
  statuses: StatusRef[];
  exclusionKeywords: string[];
}

export interface Badge {
  text: string;
  tone: Verdict | 'excluded';
  title: string;
}

const VERDICT_TEXT: Record<Verdict, string> = {
  green: 'meets target',
  orange: 'close to target',
  red: 'below target',
  unknown: 'no rent estimate',
};

export function badgeFor(card: ParsedCard, ctx: BadgeContext): Badge {
  const saved = card.externalId
    ? ctx.saved.find((s) => s.source === ctx.source && s.externalId === card.externalId)
    : undefined;
  const status = saved && ctx.statuses.find((s) => s.id === saved.statusId);

  if (status?.kind === 'excluded') {
    return {
      text: `Excluded · ${status.name}`,
      tone: 'excluded',
      title: `Saved with status “${status.name}”`,
    };
  }
  const title = (card.title ?? '').toLowerCase();
  const keyword = ctx.exclusionKeywords.find((k) => k && title.includes(k.toLowerCase()));
  if (keyword)
    return {
      text: `Excluded · ${keyword}`,
      tone: 'excluded',
      title: `Title mentions “${keyword}”`,
    };

  let text = 'est. –';
  let tone: Verdict = 'unknown';
  let hint = 'Price or area missing on the card';
  if (card.price != null && card.livingArea != null) {
    // Quick estimate at default assumptions with the reference rent (SPEC §6.5).
    const a = analyze(
      {
        price: card.price,
        livingArea: card.livingArea,
        rooms: card.rooms,
        propertyType: 'apartment',
        city: card.city,
        state: card.city ? (ctx.cityStates.get(normalizeCityKey(card.city)) ?? null) : null,
        hausgeldMonthly: null,
        actualColdRentMonthly: null,
        rentOverrideMonthly: null,
        brokerFeeOverride: null,
        renovationCost: 0,
      },
      ctx.assumptions,
      ctx.reference,
    );
    tone = a.verdict;
    text = `est. ${fmtPct(a.grossYield, 1)}`;
    hint =
      a.rent.source === 'none'
        ? 'No rent reference for this city'
        : `Gross yield with ${a.rent.source === 'placeholder_reference' ? 'PLACEHOLDER ' : ''}reference rent; net ${fmtPct(a.netYield, 1)} → ${VERDICT_TEXT[a.verdict]}`;
  }
  if (status)
    return { text: `${text} · ${status.name}`, tone, title: `${hint}. Saved: ${status.name}` };
  return { text, tone, title: hint };
}

const TONE: Record<Badge['tone'], string> = {
  green: 'background:#dcfce7;color:#166534',
  orange: 'background:#fef3c7;color:#92400e',
  red: 'background:#fee2e2;color:#991b1b',
  unknown: 'background:#e2e8f0;color:#334155',
  excluded: 'background:#cbd5e1;color:#334155;text-decoration:line-through',
};

/** Badge in its own shadow root so page CSS can't restyle it. */
export function renderBadge(doc: Document, badge: Badge): HTMLElement {
  const host = doc.createElement('span');
  host.className = 'immo-analyzer-badge';
  host.style.cssText = 'display:inline-block;margin:4px;vertical-align:middle';
  const root = host.attachShadow({ mode: 'open' });
  const pill = doc.createElement('span');
  pill.textContent = badge.text;
  pill.title = badge.title;
  pill.style.cssText = `font:600 12px/1.6 system-ui,sans-serif;padding:1px 8px;border-radius:999px;${TONE[badge.tone]}`;
  root.append(pill);
  return host;
}

/**
 * Badges every result card, including ones loaded later (debounced MutationObserver).
 * Each card element is badged at most once. Returns a stop function.
 */
export function startBadges(
  doc: Document,
  parseCards: (doc: Document) => ParsedCard[],
  ctx: BadgeContext,
  debounceMs = 250,
): () => void {
  const done = new WeakSet<Element>();
  const pass = () => {
    for (const card of parseCards(doc)) {
      if (done.has(card.element) || card.element.querySelector(':scope > .immo-analyzer-badge'))
        continue;
      done.add(card.element);
      card.element.prepend(renderBadge(doc, badgeFor(card, ctx)));
    }
  };
  let timer: ReturnType<typeof setTimeout> | undefined;
  const observer = new MutationObserver((records) => {
    // Ignore our own insertions to avoid a feedback loop.
    if (records.every((r) => [...r.addedNodes].every((n) => (n as Element).classList?.contains('immo-analyzer-badge')))) return; // prettier-ignore
    clearTimeout(timer);
    timer = setTimeout(pass, debounceMs);
  });
  pass();
  observer.observe(doc.body, { childList: true, subtree: true });
  return () => {
    observer.disconnect();
    clearTimeout(timer);
  };
}
