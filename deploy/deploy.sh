#!/usr/bin/env bash
# Runs on the server after the CD workflow syncs /opt/payagent to origin/main.
# Also safe to run by hand: sudo /opt/payagent/deploy/deploy.sh
set -euo pipefail
cd "$(dirname "$0")/.."

if [ ! -f .env ]; then
  echo "No .env in $(pwd). Copy it to the server before deploying." >&2
  exit 1
fi

docker compose build
# Pending migrations run with the new image before anything restarts. Never resets data;
# if a migration fails, set -e stops here and the previous version keeps serving.
docker compose run --rm --no-deps \
  -v "$(pwd)/db/migrations:/migrations:ro" -v "$(pwd)/backend/scripts:/app/scripts:ro" \
  -e MIGRATIONS_DIR=/migrations api python scripts/migrate.py
docker compose up -d --remove-orphans
docker image prune -f >/dev/null
docker compose ps
