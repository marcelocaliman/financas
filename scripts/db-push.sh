#!/usr/bin/env bash
# Aplica migrations no Supabase remoto via conexão direta — sem Docker.
# Lê NEXT_PUBLIC_SUPABASE_URL, SUPABASE_PROJECT_REF e SUPABASE_DB_PASSWORD do .env.local.

set -euo pipefail

if [ ! -f .env.local ]; then
  echo "✗ .env.local não encontrado. Copie .env.example e preencha." >&2
  exit 1
fi

set -a
# shellcheck disable=SC1091
source .env.local
set +a

if [ -z "${SUPABASE_PROJECT_REF:-}" ] || [ -z "${SUPABASE_DB_PASSWORD:-}" ]; then
  echo "✗ SUPABASE_PROJECT_REF e SUPABASE_DB_PASSWORD são obrigatórios em .env.local." >&2
  exit 1
fi

ENCODED_PWD=$(python3 -c 'import sys, urllib.parse; print(urllib.parse.quote(sys.argv[1], safe=""))' "$SUPABASE_DB_PASSWORD")

# Tenta conexão direta primeiro; se DNS estiver fora ou pooler-only,
# itera regiões do pooler até achar uma que responda. Sem precisar
# atualizar .env.local quando Supabase muda hosts.
CANDIDATES=(
  "postgresql://postgres:${ENCODED_PWD}@db.${SUPABASE_PROJECT_REF}.supabase.co:5432/postgres"
  "postgresql://postgres.${SUPABASE_PROJECT_REF}:${ENCODED_PWD}@aws-1-us-west-1.pooler.supabase.com:6543/postgres"
  "postgresql://postgres.${SUPABASE_PROJECT_REF}:${ENCODED_PWD}@aws-0-us-east-1.pooler.supabase.com:6543/postgres"
  "postgresql://postgres.${SUPABASE_PROJECT_REF}:${ENCODED_PWD}@aws-1-us-east-1.pooler.supabase.com:6543/postgres"
  "postgresql://postgres.${SUPABASE_PROJECT_REF}:${ENCODED_PWD}@aws-0-sa-east-1.pooler.supabase.com:6543/postgres"
)

WORKING_URL=""
for url in "${CANDIDATES[@]}"; do
  if PGCONNECT_TIMEOUT=5 psql "${url}?sslmode=require" -c "select 1" >/dev/null 2>&1; then
    WORKING_URL="$url"
    break
  fi
done

if [ -z "$WORKING_URL" ]; then
  echo "✗ Nenhum host respondeu (verifique SUPABASE_DB_PASSWORD e a rede)." >&2
  exit 1
fi

echo "→ Conectado: $(echo "$WORKING_URL" | sed -E 's#:[^:@]+@#:***@#')"
exec pnpm exec supabase db push --db-url "$WORKING_URL" --yes "$@"
