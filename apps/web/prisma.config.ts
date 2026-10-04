import { existsSync } from 'node:fs';
import { defineConfig } from 'prisma/config';

// The single .env lives at the repo root; in Docker env comes from compose instead.
if (existsSync('../../.env')) process.loadEnvFile('../../.env');

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  // plain process.env (not env()) so `prisma generate` works without a DB url
  datasource: { url: process.env.DATABASE_URL ?? '' },
});
