// Dev-time only: regenerates src/city-state.json from Wikipedia's list of German cities
// with ≥20,000 inhabitants. Run: node packages/data/scripts/fetch-cities.mjs
import { writeFileSync } from 'node:fs';

const PAGE = 'Liste_der_Groß-_und_Mittelstädte_in_Deutschland';
const STATES = {
  'Baden-Württemberg': 'BW', Bayern: 'BY', Berlin: 'BE', Brandenburg: 'BB', Bremen: 'HB',
  Hamburg: 'HH', Hessen: 'HE', 'Mecklenburg-Vorpommern': 'MV', Niedersachsen: 'NI',
  'Nordrhein-Westfalen': 'NW', 'Rheinland-Pfalz': 'RP', Saarland: 'SL', Sachsen: 'SN',
  'Sachsen-Anhalt': 'ST', 'Schleswig-Holstein': 'SH', 'Thüringen': 'TH',
}; // prettier-ignore

const url = `https://de.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(PAGE)}&prop=wikitext|revid&format=json&formatversion=2`;
const res = await fetch(url, { headers: { 'User-Agent': 'immo-analyzer-dev (personal project)' } });
const { parse } = await res.json();

const table = parse.wikitext
  .split('== Groß- und Mittelstädte nach Einwohnerzahl')[1]
  .split('|}')[0];
const cities = [];
for (const row of table.split('\n|-').slice(1)) {
  const cells = row.replace(/<!--[\s\S]*?-->/g, '').split('||');
  if (cells.length < 10) continue;
  const link = cells[1].match(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/);
  const stateName = cells
    .at(-1)
    .replace(/align="left"\s*\|/, '')
    .trim();
  const state = STATES[stateName];
  if (!link || !state) throw new Error(`Unparsed row: ${row.slice(0, 120)}`);
  const pop2020 = Number(cells[7].replace(/\D/g, '')) || null;
  cities.push({ name: (link[2] ?? link[1]).trim(), state, pop2020 });
}

const out = {
  source: `https://de.wikipedia.org/wiki/${PAGE} (revision ${parse.revid})`,
  retrievedOn: new Date().toISOString().slice(0, 10),
  cities,
};
writeFileSync(
  new URL('../src/city-state.json', import.meta.url),
  JSON.stringify(out, null, 2) + '\n',
);
console.log(`${cities.length} cities written`);
