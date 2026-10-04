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

Extension, fixtures and rent-data instructions follow in later phases.
