# immo-analyzer

Personal, localhost-only tool for analysing German buy-to-let listings. See `SPEC.md`.

> Estimates only — not financial, tax or investment advice.

## Prerequisites

- Node 24 LTS (`nvm use` reads `.nvmrc`) and pnpm via corepack: `corepack enable pnpm`
- Docker Desktop

## Run in Docker

```bash
cp .env.example .env        # then set a real POSTGRES_PASSWORD (also in DATABASE_URL)
docker compose up --build -d
curl http://127.0.0.1:3000/api/health   # → {"ok":true,"db":true}
```

If ports 5432 or 3000 are already taken, set `DB_HOST_PORT` / `APP_HOST_PORT` in `.env`
(and the port in `DATABASE_URL`).

## Local development

```bash
pnpm install
pnpm dev        # db in Docker + next dev on 127.0.0.1:3000
pnpm check      # lint, typecheck, test, build
```

## Pages

- `/` dashboard · `/pipeline` Kanban · `/properties/[id]` detail (analysis, mortgage schedule,
  sensitivity, history)
- `/calculator` — any property, full analysis, optional "Save as property"
- `/cities` — city comparison · `/data` — rent references (CSV import/export), Grunderwerbsteuer,
  city → state
- `/settings` — assumptions, pipeline statuses, API token

## Reference data

- **Transfer tax:** `packages/data/src/transfer-tax.json` (from SPEC §5b.1, please re-verify).
- **City → state:** `packages/data/src/city-state.json`, generated from Wikipedia (all cities ≥20,000
  inhabitants). Refresh with `node packages/data/scripts/fetch-cities.mjs`.
- **Rent reference:** only clearly fake demo rows (10 €/m², marked _placeholder_) are seeded. Fill in
  real Mietspiegel values per city and size band under **Data** — row by row, or download the
  **Template**, fill it in a spreadsheet and **Import CSV**. Columns:
  `city,state,size_min,size_max,eur_per_m2,source,year,notes` (bands: min inclusive, max exclusive,
  empty max = open). Then **Delete placeholder rows**.

## Chrome extension

```bash
pnpm ext:build                     # → apps/extension/.output/chrome-mv3
```

1. Chrome → `chrome://extensions` → enable **Developer mode** → **Load unpacked** →
   select `apps/extension/.output/chrome-mv3`.
2. Open the extension's **Options**: set the API base URL (default `http://127.0.0.1:3000`), paste
   the API token from the app's **Settings** page, click **Test connection**.
3. `pnpm ext:dev` runs a dev build with auto-reload.

The extension only reads pages you open yourself; its only network calls go to the local app.

## Capturing portal fixtures

Parsers are built only from real pages you saved. On a listing/search page, open DevTools → Console:

```js
copy(document.documentElement.outerHTML);
```

Paste into `apps/extension/test/fixtures/{is24,immowelt}/` as `listing-buy-N.html`,
`listing-rent-N.html` or `search-N.html`.
