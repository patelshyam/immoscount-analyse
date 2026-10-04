# Build context: repo root (see docker-compose.yml)
FROM node:24-alpine AS base
RUN corepack enable pnpm
WORKDIR /repo

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/data/package.json packages/data/
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile --ignore-scripts --filter @immo/web...

FROM deps AS build
COPY tsconfig.base.json ./
COPY packages/data packages/data
COPY apps/web apps/web
WORKDIR /repo/apps/web
RUN pnpm exec prisma generate && pnpm build

# Prisma CLI for `migrate deploy` at startup; standalone output doesn't include it.
FROM node:24-alpine AS prisma-cli
WORKDIR /opt/prisma
RUN npm init -y >/dev/null && npm install --omit=dev --no-fund --no-audit prisma@7.10.0
COPY apps/web/prisma.config.ts ./
COPY apps/web/prisma ./prisma

FROM node:24-alpine AS runner
ENV NODE_ENV=production HOSTNAME=0.0.0.0 PORT=3000 NEXT_TELEMETRY_DISABLED=1
WORKDIR /app
COPY --from=prisma-cli --chown=node:node /opt/prisma /opt/prisma
COPY --from=build --chown=node:node /repo/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /repo/apps/web/.next/static ./apps/web/.next/static
COPY --chown=node:node apps/web/docker-entrypoint.sh /usr/local/bin/
USER node
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=3s --start-period=20s \
  CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1
ENTRYPOINT ["docker-entrypoint.sh"]
