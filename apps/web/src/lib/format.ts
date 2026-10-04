const nf = (opts: Intl.NumberFormatOptions) => new Intl.NumberFormat('de-DE', opts);

const eur0 = nf({ style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const eur2 = nf({ style: 'currency', currency: 'EUR', minimumFractionDigits: 2 });

export const fmtEur = (x: number | null | undefined, cents = false) =>
  x == null ? '–' : (cents ? eur2 : eur0).format(x + 0); // +0 turns -0 into 0

export const fmtPct = (x: number | null | undefined, digits = 2) =>
  x == null
    ? '–'
    : nf({ style: 'percent', minimumFractionDigits: digits, maximumFractionDigits: digits }).format(
        x,
      );

export const fmtNum = (x: number | null | undefined, digits = 0) =>
  x == null ? '–' : nf({ maximumFractionDigits: digits }).format(x);
