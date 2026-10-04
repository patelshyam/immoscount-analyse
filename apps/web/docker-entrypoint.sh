#!/bin/sh
set -e
# 1. migrations  2. idempotent seed (runs in instrumentation.ts on server start)  3. server
(cd /opt/prisma && node node_modules/prisma/build/index.js migrate deploy)
exec node /app/apps/web/server.js
