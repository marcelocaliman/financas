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
DB_URL="postgresql://postgres:${ENCODED_PWD}@db.${SUPABASE_PROJECT_REF}.supabase.co:5432/postgres"

exec pnpm exec supabase db push --db-url "$DB_URL" --yes "$@"
