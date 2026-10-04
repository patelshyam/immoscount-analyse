# immo-analyzer

Personal, localhost-only tool for analysing German buy-to-let listings while you browse
ImmoScout24 and Immowelt, and for tracking the properties you care about. Specification:
[`SPEC.md`](SPEC.md); every deviation is recorded in [`docs/DECISIONS.md`](docs/DECISIONS.md).

> Estimates only — not financial, tax or investment advice.

| Part             | What it is                                                                           |
| ---------------- | ------------------------------------------------------------------------------------ |
| `packages/calc`  | Pure TypeScript engine: yields, cashflow, verdict, what-if, mortgage, sensitivity    |
| `packages/data`  | Transfer tax, city → state (all cities ≥ 20,000 inhabitants), defaults, CSV, schemas |
| `apps/web`       | Next.js app + API + PostgreSQL (Docker)                                              |
| `apps/extension` | Chrome MV3 extension (WXT): panel on listings, badges on search results              |

The extension only reads pages you open yourself. Its only network calls go to the local app
(`127.0.0.1`/`localhost`); nothing ever requests the portal sites.

## Prerequisites

- **Docker Desktop**
- **Node 24 LTS** and **pnpm** (needed for the extension build and local development):

  ```bash
  nvm install 24 && nvm use 24      # or `nvm use` in this folder (reads .nvmrc)
  corepack enable pnpm
  ```

## 1. Run the app

```bash
cp .env.example .env              # set POSTGRES_PASSWORD (and the same value in DATABASE_URL)
docker compose up --build -d
curl http://127.0.0.1:3000/api/health      # → {"ok":true,"db":true}
```

Open <http://127.0.0.1:3000>. On first start the container applies migrations and seeds pipeline
statuses, default assumptions, transfer-tax rates, the city → state map, demo rent rows and an
API token. Seeding is idempotent and never overwrites your edits. Both ports are bound to
`127.0.0.1` only.

**Ports already in use?** Set `APP_HOST_PORT` (default 3000) and/or `DB_HOST_PORT` (default 5432)
in `.env`, and use the same DB port in `DATABASE_URL`. The extension may talk to port 3000 or 3001.

## 2. Install the Chrome extension

```bash
pnpm install
pnpm ext:build                    # → apps/extension/.output/chrome-mv3
```

1. Chrome → `chrome://extensions` → enable **Developer mode** → **Load unpacked** → select
   `apps/extension/.output/chrome-mv3` (in the macOS file dialog press **Cmd + Shift + .** to show
   the hidden `.output` folder, or **Cmd + Shift + G** and paste the path).
2. In the app open **Settings → API token → Copy**.
3. Extension **Options** (its card in `chrome://extensions` → Details → Extension options):
   API base URL `http://127.0.0.1:3000` (or your `APP_HOST_PORT`), paste the token,
   **Test connection** → “✓ Connected and token accepted”.

After rebuilding (`pnpm ext:build`), click the reload icon on the extension card.

**What you get**

- **Listing pages** (Kauf): a panel on the right — verdict, gross/net yield, cashflow at 0/10/20 %
  equity, price/m², rent source, inputs for rent/Hausgeld/state, details, what-if, **Add to app**,
  and the pipeline status once saved. Revisiting a saved listing records a price snapshot when
  something changed. Works offline with bundled defaults (“App offline”).
- **Search pages**: an “est. x,x %” badge per result (gross yield from the reference rent, coloured
  by the net-yield verdict), the pipeline status for saved listings, and a grey **Excluded** badge
  for excluded statuses or exclusion keywords (editable in the options).

## 3. Use the app

- `/` **Dashboard** — KPIs, filters, sorting, search.
- `/pipeline` — Kanban; drag cards to change status (history is kept).
- `/properties/[id]` — edit fields and overrides, full analysis, mortgage schedule, sensitivity
  heatmap, notes, status and price history, **share links**.
- `/calculator` — analyse any property; optional **Save as property**.
- `/nearby` — enter any address → Schulen, Kindergärten, Supermärkte, ÖPNV, Ärzte, Krankenhäuser,
  Apotheken, Restaurants, Parks, Banken: everything within 2 km (straight line), or the nearest one
  if none is that close. Also on each property page (“Nearby (2 km)”, prefilled with its address).
  Uses OpenStreetMap (Nominatim + Overpass) on click — the address is sent to the public OSM
  servers; results are cached, **Refresh** re-fetches.
- `/cities` — city comparison · `/data` — reference data editors · `/settings` — assumptions,
  pipeline statuses, API token.

**Share links** (property page): create a read-only link (7/30/90 days or no expiry), copy, revoke.
`/share/<token>` shows the analysis without navigation, notes or status, is `noindex`, and returns
404 once revoked or expired. The app runs on localhost, so a link only works where the app is
reachable.

## 4. Fill in real rent data

Only clearly fake demo rows (10 €/m² for Berlin, Frankfurt am Main, Leipzig — marked
**placeholder**) are seeded; every estimate based on them shows a warning. Replace them:

1. **Data → Rent references → Template** (or `packages/data/src/rent-reference.template.csv`).
2. One row per city and size band:
   `city,state,size_min,size_max,eur_per_m2,source,year,notes` — bands `<40`, `40–60`, `60–80`,
   `80–100`, `>100` m² (min inclusive, max exclusive, empty max = open); decimals `8.5` or `"8,5"`.
3. **Import CSV** (all-or-nothing; errors are listed by line), then **Delete placeholder rows**.

Transfer-tax rates come from SPEC §5b.1 — re-verify them under **Data → Grunderwerbsteuer** and set
“verified on”. Missing or ambiguous city names (e.g. “Frankfurt”, “Halle”) can be added under
**Data → City → state**; the extension also remembers a state you pick for an unknown city.

## 5. Development

```bash
pnpm dev          # db in Docker + next dev on 127.0.0.1:3000 (reads the root .env)
pnpm ext:dev      # extension with hot reload
pnpm test         # vitest in every package
pnpm lint         # eslint + prettier --check
pnpm typecheck
pnpm build
pnpm check        # all of the above
```

Schema change: edit `apps/web/prisma/schema.prisma`, then `pnpm --filter @immo/web db:migrate`.
The city list can be regenerated from Wikipedia with `node packages/data/scripts/fetch-cities.mjs`.

## 6. Portal fixtures (parser tests)

Parsers are written only against real pages you saved. On a page, open DevTools → Console:

```js
copy(document.documentElement.outerHTML);
```

Paste into `apps/extension/test/fixtures/{is24,immowelt}/` as `listing-buy-N.html`,
`listing-rent-N.html` or `search-N.html`, then add expectations to the parser tests. (“Save page
as…” also works; its `*_files/` folders are git-ignored.) Current coverage and known gaps are in
`docs/DECISIONS.md`.

## Troubleshooting

- `pnpm: command not found` → `nvm use 24` (or `nvm alias default 24`), then `corepack enable pnpm`.
- Extension says **App offline** → app running? base URL/port right? **Test connection** in the
  options.
- **Token rejected** → the token was regenerated in Settings; paste the new one.
- Dashboard error “database not reachable” → `docker compose up -d db`.
