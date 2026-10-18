#!/usr/bin/env bash
# Leave the shared database with only the seed history (vendors, POs, rules, SEED invoices).
#   scripts/reset-demo.sh            clean only
#   scripts/reset-demo.sh --run-set  clean, then process the 16 test invoices (costs a few cents of Gemini)
# Production and local share the same Supabase database: this clears both.
set -euo pipefail

repo="$(cd "$(dirname "$0")/.." && pwd)"
env_file="${ENV_FILE:-$repo/.env}"
[ -f "$env_file" ] || env_file="$(git -C "$repo" worktree list | head -1 | cut -d' ' -f1)/.env"
[ -f "$env_file" ] || { echo "No .env found (set ENV_FILE)." >&2; exit 1; }

set -a; . "$env_file"; set +a
export STORAGE_DIR="${STORAGE_DIR:-$repo/storage}"
cd "$repo/backend"

uv run python scripts/reset_demo.py --yes
uv run python scripts/backfill_seed_hits.py
if [ "${1:-}" = "--run-set" ]; then
  uv run python scripts/run_set.py tests/fixtures/invoices
fi
