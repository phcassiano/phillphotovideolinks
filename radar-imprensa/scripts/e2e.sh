#!/usr/bin/env bash
# E2E completo: recria o banco de teste, sobe PostgREST + gateway de Auth de teste,
# faz o build do app com essas variáveis, inicia em :3100 e roda o Playwright.
# Requisitos: PostgreSQL local (DATABASE_URL_TEST), binário `postgrest` no PATH
# (ou POSTGREST_BIN) e Chromium do Playwright (CHROMIUM_PATH opcional).
set -euo pipefail
cd "$(dirname "$0")/.."

# Processos em grupos próprios (setsid) para encerrar também os filhos no final.
setsid node tests/e2e/stack/start-stack.mjs > /tmp/radar-e2e-stack.log 2>&1 &
STACK=$!
trap 'kill -- -$STACK ${APP:+-$APP} 2>/dev/null || true' EXIT
rm -f tests/e2e/.env.e2e
for _ in $(seq 1 30); do [ -f tests/e2e/.env.e2e ] && grep -q "pronto" /tmp/radar-e2e-stack.log && break; sleep 1; done

set -a; . tests/e2e/.env.e2e; set +a
npx next build
PORT=3100 setsid npx next start > /tmp/radar-e2e-app.log 2>&1 &
APP=$!
sleep 5
npx playwright test "$@"
