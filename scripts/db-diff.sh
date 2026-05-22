#!/usr/bin/env bash
# Mostra diferenças entre migrations locais e o Supabase remoto — sem Docker.

set -euo pipefail

if [ ! -f .env.local ]; then
  echo "✗ .env.local não encontrado." >&2
  exit 1
fi

set -a
# shellcheck disable=SC1091
source .env.local
set +a

ENCODED_PWD=$(python3 -c 'import sys, urllib.parse; print(urllib.parse.quote(sys.argv[1], safe=""))' "$SUPABASE_DB_PASSWORD")
DB_URL="postgresql://postgres:${ENCODED_PWD}@db.${SUPABASE_PROJECT_REF}.supabase.co:5432/postgres"

exec pnpm exec supabase db push --db-url "$DB_URL" --dry-run "$@"
