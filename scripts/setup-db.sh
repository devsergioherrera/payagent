#!/usr/bin/env bash
# Create or update the database: schema, seed (vendors, POs, budget, 16 rules) and the October history.
#   scripts/setup-db.sh              apply pending migrations
#   scripts/setup-db.sh --run-set    then process the 16 test invoices (needs GEMINI_API_KEY)
set -euo pipefail

repo="$(cd "$(dirname "$0")/.." && pwd)"
env_file="${ENV_FILE:-$repo/.env}"
[ -f "$env_file" ] || env_file="$(git -C "$repo" worktree list | head -1 | cut -d' ' -f1)/.env"
[ -f "$env_file" ] || { echo "No .env found (copy .env.example to .env, or set ENV_FILE)." >&2; exit 1; }

set -a; . "$env_file"; set +a
export STORAGE_DIR="${STORAGE_DIR:-$repo/storage}"
cd "$repo/backend"

uv run python scripts/migrate.py
uv run python scripts/backfill_seed_hits.py
if [ "${1:-}" = "--run-set" ]; then
  uv run python scripts/run_set.py tests/fixtures/invoices
fi
