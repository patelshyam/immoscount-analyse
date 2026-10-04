import { stateCodeSchema, rentReferenceSchema, type RentReferenceRow } from './schemas';
import type { StateCode } from '@immo/calc';

/** RFC 4180-ish: quoted fields, "" escapes, commas/newlines inside quotes, CRLF or LF. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  const src = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += ch;
  }
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

const esc = (v: string) => (/[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
export const toCsv = (rows: (string | number | null)[][]) =>
  rows.map((r) => r.map((v) => esc(v == null ? '' : String(v))).join(',')).join('\n') + '\n';

/** Template columns (SPEC §5b.3); export adds `is_placeholder` so a round trip keeps the flag. */
export const RENT_CSV_COLUMNS = [
  'city',
  'state',
  'size_min',
  'size_max',
  'eur_per_m2',
  'source',
  'year',
  'notes',
] as const;
const EXPORT_COLUMNS = [...RENT_CSV_COLUMNS, 'is_placeholder'] as const;

export type RentCsvRow = RentReferenceRow & { state: StateCode | null };

export interface CsvError {
  line: number;
  message: string;
}

/** Numbers in the CSV may be "8.5" or German "8,5" (quoted). */
const num = (s: string) => {
  const t = s.trim();
  if (t === '') return null;
  const n = Number(t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t);
  return Number.isFinite(n) ? n : NaN;
};

export function parseRentCsv(text: string): { rows: RentCsvRow[]; errors: CsvError[] } {
  const [header, ...body] = parseCsv(text);
  const cols = (header ?? []).map((h) => h.trim().toLowerCase());
  const missing = RENT_CSV_COLUMNS.filter((c) => !cols.includes(c));
  if (missing.length) {
    return { rows: [], errors: [{ line: 1, message: `missing column(s): ${missing.join(', ')}` }] };
  }
  const rows: RentCsvRow[] = [];
  const errors: CsvError[] = [];
  body.forEach((cells, i) => {
    const line = i + 2;
    const get = (c: string) => (cells[cols.indexOf(c)] ?? '').trim();
    const state = get('state');
    const stateParsed = state ? stateCodeSchema.safeParse(state.toUpperCase()) : null;
    if (stateParsed && !stateParsed.success) {
      errors.push({ line, message: `state "${state}" is not a Bundesland code (e.g. HE, BY)` });
      return;
    }
    const placeholder =
      cols.includes('is_placeholder') && /^(true|1|yes|ja)$/i.test(get('is_placeholder'));
    const r = rentReferenceSchema.safeParse({
      city: get('city'),
      sizeMin: num(get('size_min')) ?? 0,
      sizeMax: num(get('size_max')),
      eurPerM2: num(get('eur_per_m2')),
      source: get('source'),
      year: num(get('year')),
      isPlaceholder: placeholder,
      notes: get('notes') || null,
    });
    if (!r.success) {
      errors.push({
        line,
        message: r.error.issues.map((x) => `${x.path.join('.') || 'row'}: ${x.message}`).join('; '),
      });
      return;
    }
    rows.push({ ...r.data, state: stateParsed?.success ? stateParsed.data : null });
  });
  return { rows, errors };
}

export function rentRowsToCsv(rows: RentCsvRow[]): string {
  return toCsv([
    [...EXPORT_COLUMNS],
    ...rows.map((r) => [
      r.city,
      r.state,
      r.sizeMin,
      r.sizeMax,
      r.eurPerM2,
      r.source,
      r.year,
      r.notes,
      r.isPlaceholder ? 'true' : 'false',
    ]),
  ]);
}
