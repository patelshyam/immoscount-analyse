# SPEC — immo-analyzer (personal rental-property analysis tool)

You are building a **personal, single-user tool** that analyzes German buy-to-let property listings while I browse ImmoScout24 and Immowelt, and tracks the properties I care about in a local web app. Everything runs on **localhost** (web app + database in Docker; Chrome extension loaded unpacked).

Read this whole document before writing any code.

---

## 0. How to work with me

1. **Before Phase 0:** reply with (a) your understanding in ≤15 bullets, (b) the proposed file tree, (c) the exact package versions you plan to use (look them up with `pnpm view <pkg> version` — do not rely on memory), (d) blocking questions only. Then wait for my "go".
2. **Work strictly phase by phase** (§10). At the end of every phase:
   - run `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `docker compose up --build -d` + health check;
   - fix all failures;
   - `git commit` (conventional commits, one or more per phase);
   - post a short summary: what was built, how I can try it, known gaps;
   - **STOP and wait for me to say "continue".**
3. **Never invent facts you can't verify:**
   - no guessed CSS selectors for the portals — derive them from the HTML fixtures I provide (§6.3); if fixtures are missing, stop and ask;
   - no invented rent data (§5b.3);
   - no package versions from memory.
4. Record every deviation from this spec, with the reason, in `docs/DECISIONS.md`.
5. Keep it simple: single user, localhost only, no cloud services, no user accounts.

---

## 1. Goal and scope

Three parts sharing one calculation library:

| Part | Purpose |
|---|---|
| `packages/calc` | Pure TypeScript calculation engine (yields, cashflow, verdict, what-if, mortgage, sensitivity). Used by the extension, the web UI and the API, so every number is computed identically everywhere. |
| `apps/extension` | Chrome MV3 extension. On a listing page it shows an analysis panel; on search-result pages it shows small badges; it can save a listing to the app. |
| `apps/web` | Next.js app (UI + API route handlers) with PostgreSQL: dashboard, pipeline, property detail, calculator, city comparison, settings, data editors, read-only share links. |

**Out of scope:** automated market alerts/crawling, mobile app, multi-user/auth system, payments, tax (AfA) calculations (may come later), deployment to the internet.

---

## 2. Hard constraints

- **No automated requests to immobilienscout24.de or immowelt.de.** The extension only reads the DOM of pages I open myself. No background fetching of listings, no headless browsers, no crawling, no polling of search pages.
- Original name and UI. Do not copy text, branding, layouts or code from any third-party product.
- All container ports bound to `127.0.0.1` only.
- No secrets in git; provide `.env.example`.
- Show a disclaimer in the web app footer and in the extension panel: *"Estimates only — not financial, tax or investment advice."*
- **Units convention (critical):** all rates are decimal fractions in code and DB (`0.035` = 3.5 %); convert to percent only in the UI. Money is EUR. DB stores money as `Decimal`; the calc library uses `number` and rounds only for display.
- UI language: English, keeping German domain terms where they are the natural term (Hausgeld, Mietspiegel, Kaltmiete, Grunderwerbsteuer). Number/currency formatting: `de-DE`.

---

## 3. Tech stack

- **Monorepo:** pnpm workspaces, TypeScript `strict`, current Node LTS.
- **packages/calc:** zero runtime dependencies, Vitest.
- **packages/data:** typed seed data + JSON/CSV files, Zod schemas.
- **apps/web:** Next.js (App Router), route handlers as the API, Prisma + PostgreSQL 16, Zod, Tailwind CSS, Recharts (charts), dnd-kit (Kanban).
- **apps/extension:** Chrome Manifest V3 built with **WXT** (if unsuitable, Vite + CRXJS — note it in DECISIONS.md); Preact or React for the panel; happy-dom or jsdom for parser tests.
- **Tooling:** ESLint, Prettier, Vitest; Playwright optional for one web smoke test.
- **Docker:** `docker-compose.yml` with `db` (postgres:16) and `app` (Next.js standalone, multi-stage Dockerfile, non-root user).

---

## 4. Repository layout

```
immo-analyzer/
├─ SPEC.md
├─ README.md
├─ docs/DECISIONS.md
├─ docker-compose.yml
├─ .env.example
├─ package.json / pnpm-workspace.yaml / tsconfig.base.json / eslint + prettier config
├─ packages/
│  ├─ calc/            # src/*.ts, test/*.test.ts
│  └─ data/            # transfer-tax.json, city-state.json, size-bands.ts, defaults.ts,
│                      # rent-reference.template.csv, schemas.ts
├─ apps/
│  ├─ web/             # Next.js app, prisma/schema.prisma, prisma/seed.ts, Dockerfile
│  └─ extension/       # WXT project
│     ├─ entrypoints/  # content scripts, background, options
│     ├─ src/parsers/  # is24.ts, immowelt.ts, common.ts (German number parsing etc.)
│     └─ test/fixtures/{is24,immowelt}/   # HTML fixtures provided by me
```

---

## 5. Domain logic — `packages/calc`

### 5.1 Inputs

```ts
type StateCode = 'BW'|'BY'|'BE'|'BB'|'HB'|'HH'|'HE'|'MV'|'NI'|'NW'|'RP'|'SL'|'SN'|'ST'|'SH'|'TH';
type PropertyType = 'apartment' | 'house' | 'multi_family';

interface PropertyInput {
  price: number;                    // purchase price P
  livingArea: number;               // m², A
  rooms: number | null;
  propertyType: PropertyType;
  city: string | null;
  state: StateCode | null;
  hausgeldMonthly: number | null;   // total Hausgeld (apartments); null = unknown
  actualColdRentMonthly: number | null; // if already let (vermietet)
  rentOverrideMonthly: number | null;   // manual override by me
  brokerFeeOverride: number | null;     // fraction; 0 if "provisionsfrei"
  renovationCost: number;           // R, default 0
}
```

### 5.2 Assumptions (editable in Settings; these are starting defaults, not facts)

| Field | Default | Meaning |
|---|---|---|
| `targetNetYield` | 0.04 | My target net yield |
| `orangeBand` | 0.005 | Within 0.5 pp below target → orange |
| `notaryAndRegistry` | 0.02 | Notary + land registry, fraction of price |
| `brokerFee` | 0.0357 | Buyer's broker fee incl. VAT (overridable per property) |
| `maintenancePerM2PerYear` | 12 | EUR per m² per year (landlord's own reserve) |
| `vacancyRate` | 0.03 | Share of annual rent |
| `hausgeldNonRecoverableShare` | 0.35 | Share of Hausgeld not passed on to the tenant |
| `managementMonthly` | 0 | Sondereigentumsverwaltung per unit |
| `interestRate` | 0.035 | Placeholder — I set my bank's actual offer |
| `initialRepayment` | 0.02 | Anfängliche Tilgung |
| `fixedRateYears` | 10 | Zinsbindung |
| `equityScenarios` | [0, 0.10, 0.20] | Equity as share of purchase price |
| `defaultEquityShare` | 0.10 | Used for break-even and badges |

### 5.3 Formulas

Let `g` = transfer tax rate for the state, `n` = notaryAndRegistry, `b` = broker fee (override or default), `k = 1 + g + n + b`, `R` = renovationCost, `i` = interestRate, `t` = initialRepayment, `v` = vacancyRate, `s` = hausgeldNonRecoverableShare.

- **Rent resolution order:** `rentOverrideMonthly` → `actualColdRentMonthly` → estimate from rent reference (§5b.3) → none. Expose `rentSource: 'override' | 'actual' | 'reference' | 'placeholder_reference' | 'none'`.
- **Total cost:** `C = P·k + R`, with a breakdown (transfer tax, notary, broker, renovation).
- **Price per m²:** `P / A`
- **Gross yield:** `12M / P`
- **Non-recoverable Hausgeld:** `Hnr = (hausgeldMonthly ?? 0) · s` (houses: 0)
- **NOI (annual):** `12M(1 − v) − 12·Hnr − maintenancePerM2PerYear·A − 12·managementMonthly`
- **Net yield:** `NOI / C`
- **Per equity scenario `e`:**
  - equity `E = e·P`
  - loan `L = max(0, C − E)`
  - annual debt service `D = L·(i + t)`
  - monthly cashflow `(NOI − D) / 12`
  - monthly cashflow excluding repayment `(NOI − L·i) / 12`
- **Unknown state:** use the highest rate in the table and add a warning.
- **Missing rent:** return analysis with yields/cashflow `null`, verdict `'unknown'`, and a warning.

### 5.4 Verdict

`netYield == null` → `'unknown'` (grey); `≥ target` → `'green'`; `≥ target − orangeBand` → `'orange'`; else `'red'`.

### 5.5 What-if (closed form, general with R)

- **Break-even price** (cashflow = 0 at equity `e`): `P = (NOI / (i + t) − R) / (k − e)`
- **Price for target net yield:** `P = (NOI / target − R) / k`
- **Required monthly rent for target net yield:** `M = (target·C + 12·Hnr + maint + 12·mgmt) / (12·(1 − v))`
- **Required monthly rent for zero cashflow at equity `e`:** `M = (L·(i + t) + 12·Hnr + maint + 12·mgmt) / (12·(1 − v))`

Return `null` when a result is not meaningful (e.g. negative price).

### 5.6 Mortgage schedule

- Constant monthly payment `L·(i + t)/12`.
- Each month: interest = balance·i/12, principal = payment − interest.
- Return yearly rows (interest, principal, end balance), remaining balance after `fixedRateYears`, total interest within the fixed period, and estimated payoff years at constant rate.
- Handle `L = 0` and `i = 0`.

### 5.7 Sensitivity

- 5×5 grid: price factor × rent factor ∈ {−10 %, −5 %, 0, +5 %, +10 %} → net yield and monthly cashflow at `defaultEquityShare`.
- 1-D: interest rate Δ ∈ {−1, −0.5, 0, +0.5, +1} pp → monthly cashflow.

### 5.8 Exported API (adjust names if you have a better design, but keep it pure)

```ts
analyze(input: PropertyInput, a: Assumptions, ref: ReferenceData): Analysis
verdictFor(netYield: number | null, a: Assumptions): Verdict
breakEvenPrice(...), priceForTargetYield(...), requiredRentForTarget(...), requiredRentForZeroCashflow(...)
amortizationSchedule(loan, interestRate, initialRepayment, fixedRateYears): Schedule
sensitivityGrid(input, a, ref): SensitivityResult
estimateRent(city, livingArea, rentRefs): { monthlyRent, eurPerM2, isPlaceholder, source } | null
transferTaxRate(state, table, onDate?): number
```

`Analysis` contains:
- total cost and breakdown, price/m², rent used + `rentSource`
- gross yield, NOI (with breakdown), net yield
- `scenarios[]` (equity, loan, debt service, cashflow, cashflow ex repayment)
- verdict, `whatIf` block, `warnings[]`, the assumptions used

### 5.9 Golden test case (must pass, tolerance ±0.01 for €/% values, ±1 € for prices)

Apartment in Hessen (`HE`, transfer tax 6.0 %).
- Inputs: P = 300,000; A = 75 m²; 3 rooms; actual cold rent 1,000 €/month; Hausgeld 300 €/month; R = 0; broker 3.57 %.
- Defaults: n = 2 %, maintenance 12 €/m²/yr, v = 3 %, s = 0.35, mgmt = 0, i = 3.5 %, t = 2 %, target 4 %.

| Output | Expected |
|---|---|
| k / total cost C | 1.1157 / 334,710.00 |
| Price per m² | 4,000.00 |
| Gross yield | 4.00 % |
| NOI | 9,480.00 (11,640 − 1,260 − 900) |
| Net yield | 2.832 % |
| Cashflow/month at 0 % equity | −744.09 |
| Cashflow/month at 10 % equity (L = 304,710) | −606.59 |
| Cashflow/month at 20 % equity | −469.09 |
| Cashflow ex repayment at 10 % equity | −98.74 |
| Verdict | red |
| Break-even price at 10 % equity | ≈ 169,699 |
| Price for 4 % target | ≈ 212,423 |
| Required rent for 4 % target | ≈ 1,335.77 €/month |

**Also test these edge cases:**
- zero rent / missing rent
- missing Hausgeld on an apartment (assume 0 + warning)
- house without Hausgeld
- equity ≥ total cost (loan 0)
- interest rate 0
- unknown state
- renovation cost > 0

---

## 5b. Reference data — `packages/data` (seeded into the DB)

### 5b.1 Transfer tax (Grunderwerbsteuer)

Store as `{ state, rate, validFrom | null, verifiedOn, source }`.

Rates as of October 2026 (I will re-verify; add a test that all 16 states exist and 0 < rate < 0.1):

| State | Rate | Note |
|---|---|---|
| BY | 0.035 | |
| BW, NI, RP, ST | 0.05 | |
| TH | 0.05 | since 2024-01-01 |
| HB | 0.055 | since 2025-07-01 |
| HH, SN | 0.055 | since 2023-01-01 |
| BE, HE, MV | 0.06 | |
| BB, NW, SL, SH | 0.065 | |

### 5b.2 City → state

Seed a mapping for all German cities with ≥100,000 inhabitants. Normalize keys: lowercase, umlauts → ae/oe/ue, ß → ss, strip suffixes like "(Saale)", "am Main" handled via aliases.

Unknown cities: the extension asks me to pick the state once and stores the mapping via the API.

### 5b.3 Rent reference (Mietspiegel-style)

- **Do not invent real rent figures.**
- Create `rent-reference.template.csv` with columns `city,state,size_min,size_max,eur_per_m2,source,year,notes`.
- Size bands: `<40`, `40–60`, `60–80`, `80–100`, `>100` m².
- Seed a few clearly fake **demo** rows with `is_placeholder = true` so the UI works; every estimate based on a placeholder row shows a warning badge ("placeholder rent data").
- I will fill in real values for my cities via the CSV import or the data editor.

---

## 6. Chrome extension — `apps/extension`

### 6.1 Manifest and permissions

- MV3.
- Content scripts on `https://www.immobilienscout24.de/*` and `https://www.immowelt.de/*`; route internally by URL + DOM detection.
- Permissions: `storage`.
- `host_permissions`: the two portals plus `http://127.0.0.1:3000/*` and `http://localhost:3000/*`.
- Minimal permissions — nothing else unless justified in DECISIONS.md.

### 6.2 Page types handled

- **Purchase listing page (Kauf):** full panel.
- **Search-result page:** badges on each result card.
- **Rental listing page (Miete):** in Phase 5 only, a small "Save as rent comp" button. Otherwise do nothing.

### 6.3 Parsing

Use a common interface:

```ts
interface PortalParser {
  id: 'is24' | 'immowelt';
  matches(url: URL): boolean;
  pageType(doc: Document, url: URL): 'listing_buy' | 'listing_rent' | 'search' | 'other';
  parseListing(doc: Document, url: URL): ParsedListing;   // all fields nullable + warnings[]
  parseSearchCards(doc: Document): ParsedCard[];          // externalId, url, price, area, rooms, city, title, element
}
```

**Extraction strategy, in order:**
1. Structured data embedded in the page (JSON-LD, JSON app state in `<script>` tags).
2. Stable attributes or classes.
3. Label-based text extraction ("Kaufpreis", "Wohnfläche", "Zimmer", "Hausgeld", "Kaltmiete", "Provision"/"provisionsfrei", "Baujahr", "vermietet").

**Fields to extract:** externalId, url, title, propertyType, price, livingArea, rooms, hausgeldMonthly, actualColdRentMonthly (if vermietet), brokerFee (0 if provisionsfrei), yearBuilt, postalCode, city, street (if shown).

**German number parsing** in `common.ts` with unit tests: `"349.000 €"` → 349000, `"78,5 m²"` → 78.5, `"3,5 Zi."` → 3.5, `"1.250,50 €"` → 1250.5.

**Fixtures:** I will save real pages to `apps/extension/test/fixtures/{is24,immowelt}/` as `listing-buy-*.html`, `listing-rent-*.html`, `search-*.html`, captured from DevTools with `copy(document.documentElement.outerHTML)`.
- All parser tests run against these fixtures.
- **If the fixtures for the current phase are missing, stop and ask me for them. Do not guess selectors.**
- Keep each portal's parser isolated; when a field can't be parsed, return `null` + a warning (never crash).

### 6.4 Analysis panel (listing pages)

**Container and behaviour:**
- Fixed-position container on the right side, rendered in a **Shadow DOM**, so page CSS can't leak in and the page layout doesn't shift.
- About 340 px wide; collapsible to a small tab; collapsed state remembered in `chrome.storage.local`.
- Appears automatically (don't use `chrome.sidePanel`, which needs a user gesture to open).

**Content:**
- **Header:** city · rooms · m².
- **Verdict pill.**
- **Metric grid:** gross yield, net yield, monthly cashflow with a 0 / 10 / 20 % equity switch, price/m².
- **Rent line:** source badge (actual / estimated / placeholder / missing) and inline edit to override the rent.
- **Inputs for missing data:** state, Hausgeld, rent. Recompute live via `@immo/calc` on every edit.
- **Collapsible "Details":** cost breakdown, NOI breakdown, assumptions used.
- **Collapsible "What-if":** break-even price, price for target yield, required rent.
- **Save controls:**
  - "Add to app" button; once saved it becomes "Saved ✓ · Open in app" plus a status dropdown.
  - If the listing is already saved, show the saved status.
  - On revisit, send updated fields so the app records a snapshot when the price or other key fields changed. This is passive: it only happens because I opened the page.
- **Warnings list** and the disclaimer.

### 6.5 Search-result badges

- Per card: small badge with gross yield (using estimated rent) and a colour from a quick net-yield estimate at default assumptions, labelled "est.".
- If the property is saved in the app, show its pipeline status.
- **Exclusion:** grey "Excluded" badge with the reason if the saved status is of kind `excluded`, or if a keyword rule matches the card title. Default keywords (editable in options): Erbbaurecht, Erbpacht, Nießbrauch, Wohnrecht, Zwangsversteigerung, Versteigerung.
- Results load dynamically: use a debounced `MutationObserver`, never badge a card twice, and handle SPA URL changes.

### 6.6 Communication with the app

- Content script ↔ background service worker via `chrome.runtime` messages. **Only the service worker calls the API**: `fetch(apiBaseUrl + path)` with `Authorization: Bearer <token>`. This avoids CORS and mixed-content issues on the HTTPS portal pages.
- On startup and every 10 minutes (or on demand), fetch `GET /api/extension/bootstrap` and cache it in `chrome.storage.local`. It contains: assumptions, transfer tax table, city→state map, rent references, pipeline statuses, and an index of saved properties `{ source, externalId, id, statusId }`.
- **If the app is unreachable**, the panel still works with the bundled `packages/data` defaults. "Add to app" is disabled with an "App offline" hint.

### 6.7 Options page

- API base URL (default `http://127.0.0.1:3000`), API token, "Test connection" button.
- Per-portal on/off toggles and a badges on/off toggle.
- Exclusion keywords.

---

## 7. Web app — `apps/web`

### 7.1 Pages

- **`/` Dashboard:**
  - KPI tiles: count, average gross yield, average net yield, average cashflow at default equity.
  - Property table with filters (verdict, status, city, source), sorting and text search.
  - Columns: property (city · rooms · m²), price, gross yield, net yield, cashflow, verdict, status, last seen.
- **`/pipeline`:** Kanban by status with drag & drop (dnd-kit) and counts. Moves create `StatusEvent`s.
- **`/properties/[id]`:**
  - editable fields and overrides, full analysis, scenario table;
  - mortgage schedule (chart + table), what-if block, sensitivity heatmap;
  - notes, status history, price/snapshot history;
  - link to the original listing, share-link management.
- **`/calculator`:** stateless form (city, state, type, price, area, rooms, optional rent, Hausgeld, broker fee) → full analysis; "Save as property" optional.
- **`/cities`:** comparison per city: number of saved properties, median price/m², average gross/net yield, reference rent €/m², implied gross yield from reference rent ÷ median price/m².
- **`/settings`:**
  - assumptions form (Zod-validated);
  - pipeline statuses: add, rename, reorder, color, kind = `open` | `excluded` | `closed`;
  - API token: generated on first run, shown with a copy button, regenerate.
- **`/data`:** editors for transfer tax, city→state and rent references; CSV import/export for rent references.
- **`/share/[token]`:** read-only analysis page, no navigation, `noindex`, works only while the link is not revoked or expired.

### 7.2 API (route handlers, JSON, Zod-validated)

**Auth:** accept the request if it is same-origin (`Sec-Fetch-Site: same-origin`) or carries a valid bearer token; otherwise 401. `/api/health` and `/share/*` are public on localhost.

- `GET /api/health` → `{ ok, db }`
- `GET /api/extension/bootstrap`
- `POST /api/properties` — upsert by `(source, externalId)`; updates `lastSeenAt`; creates a `PropertySnapshot` when price or key fields changed
- `GET /api/properties` (filters, sort, pagination), `GET|PATCH|DELETE /api/properties/:id`
- `GET /api/properties/lookup?source=&externalId=`
- `POST /api/properties/:id/status` (body: statusId, note)
- `POST /api/properties/:id/share`, `DELETE /api/share-links/:id`
- `POST /api/calculate` (stateless)
- `GET|PUT /api/settings/assumptions`, `POST /api/settings/token/regenerate`
- `GET|POST|PATCH|DELETE /api/statuses` (+ reorder)
- `GET|PUT /api/transfer-tax`
- `GET|POST /api/city-state`
- `GET|POST|PATCH|DELETE /api/rent-references`, `POST /api/rent-references/import` (CSV), `GET /api/rent-references/export`
- `GET /api/cities/compare`
- Phase 5, optional: `POST /api/rent-comps`

### 7.3 Data model (Prisma)

- **Property:**
  - `id` (cuid), `source` (enum is24 | immowelt | manual), `externalId?`, `url?`, `title?`, `propertyType`
  - address: `street?`, `postalCode?`, `city?`, `state?`
  - numbers: `price`, `livingArea`, `rooms?`, `hausgeldMonthly?`, `actualColdRentMonthly?`, `rentOverrideMonthly?`, `brokerFeeOverride?`, `renovationCost` (default 0), `yearBuilt?`
  - pipeline: `statusId`, `notes`, `excludedReason?`
  - timestamps: `createdAt`, `updatedAt`, `lastSeenAt`
  - unique `(source, externalId)`
- **PropertySnapshot:** `id`, `propertyId`, `capturedAt`, `price`, `fields` (Json)
- **StatusEvent:** `id`, `propertyId`, `fromStatusId?`, `toStatusId`, `at`, `note?`
- **PipelineStatus:** `id`, `name`, `color`, `sortOrder`, `kind` (open | excluded | closed). Seed: New, Analyzing, Viewing scheduled, Offer made, Financing, Notary appointment, Closed (closed), Rejected (excluded).
- **Settings** (singleton): `assumptions` (Json, Zod-validated), `apiToken`
- **TransferTaxRate:** `state`, `rate`, `validFrom?`, `verifiedOn?`, `source?`
- **CityState:** `cityKey` (normalized, unique), `displayName`, `state`
- **RentReference:** `id`, `city`, `sizeMin`, `sizeMax`, `eurPerM2`, `source`, `year`, `isPlaceholder`, `notes?`
- **ShareLink:** `id`, `propertyId`, `token` (32 random bytes, base64url, unique), `createdAt`, `expiresAt?`, `revokedAt?`
- Phase 5, optional: **RentComp** — `city`, `postalCode`, `livingArea`, `rooms`, `coldRentMonthly`, `url`, `capturedAt`

Analyses are computed on the fly from current data + settings; they are not stored.

---

## 8. Docker and local run

**`apps/web/Dockerfile`:**
- multi-stage (deps → build → runner), Next.js `output: 'standalone'`, non-root user;
- entrypoint runs `prisma migrate deploy`, then an **idempotent** seed, then `node server.js`.

**`docker-compose.yml`:**
- `db`: postgres:16, named volume, healthcheck `pg_isready`; not published, or published on `127.0.0.1:5432` only for local tooling.
- `app`: `depends_on: db (condition: service_healthy)`, ports `127.0.0.1:3000:3000`, env from `.env`.

**Root scripts:**
- `pnpm dev`: db in Docker + `next dev` locally
- `pnpm build`, `pnpm test`, `pnpm lint`, `pnpm typecheck`
- `pnpm check`: all of the above
- `pnpm ext:dev`, `pnpm ext:build`

**README:**
- prerequisites, `cp .env.example .env`, `docker compose up --build`;
- how to load the unpacked extension (path to the build output);
- how to copy the API token from Settings into the extension options;
- how to capture fixtures;
- how to fill in rent reference data.

---

## 9. Testing and quality

- **calc:** every exported function tested; golden case (§5.9) and all listed edge cases.
- **data:** schema tests (16 states, valid rates, no duplicate city keys).
- **extension:**
  - parser tests against fixtures; German number parser tests;
  - a test that the panel renders with a parsed fixture (component test);
  - a test that no network request goes to the portal domains (the service worker only calls `apiBaseUrl`).
- **web:** route handler tests for validation, auth (401 without token, 200 same-origin/token) and the upsert/snapshot logic; optional Playwright smoke test (calculator page).
- No TypeScript `any` without a comment explaining why.

---

## 10. Phases and acceptance criteria

| Phase | Build | Acceptance criteria |
|---|---|---|
| **0 — Scaffold** | Monorepo, tooling, Prisma schema + migration + seed, Docker setup, `/api/health` | `docker compose up --build` → `http://127.0.0.1:3000/api/health` returns `{ ok: true, db: true }`; `pnpm check` green |
| **1 — Engine + calculator** | `packages/calc`, `packages/data`, `/calculator`, `/settings` (assumptions + token), `/api/calculate` | Golden test passes; calculator shows full analysis; assumptions persist across restarts |
| **2 — Extension MVP (ImmoScout24 listing)** | IS24 listing parser (fixtures required), Shadow-DOM panel, client-side calc with bundled data, options page | Load unpacked → open an IS24 purchase listing → panel shows verdict, yields, cashflow within ~1 s; editing rent/state recalculates; no requests to the portal |
| **3 — App integration** | Bootstrap endpoint, Add to app, lookup, statuses CRUD, dashboard, pipeline Kanban, property detail (basic), snapshots on revisit | Saving from the extension appears in dashboard and pipeline; drag & drop changes status with history; revisiting a saved listing with a changed price records a snapshot |
| **4 — Immowelt + search pages** | Immowelt parser (fixtures required), search-result badges for both portals, exclusion rules | Badges appear on dynamically loaded results without duplicates; saved/excluded properties are marked |
| **5 — Tools + data** | Mortgage schedule, what-if, sensitivity heatmap, `/cities`, `/data` editors, CSV import/export; optional rent comps | All tools match calc unit tests; CSV round-trip works; placeholder-data warnings visible wherever used |
| **6 — Sharing + polish** | Share links (create/revoke/expire), empty/error/loading states, README complete | Share link opens read-only page; revoked link returns 404; fresh clone → README steps → working app + extension |

---

## 11. Definition of done (whole project)

- Fresh clone + README steps → working app in Docker and working extension in Chrome.
- `pnpm check` is green; golden test passes.
- No requests from any component to the portal domains; all container ports bound to 127.0.0.1.
- `docs/DECISIONS.md` lists every deviation from this spec.
