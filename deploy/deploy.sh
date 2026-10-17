#!/usr/bin/env bash
# Runs on the server after the CD workflow syncs /opt/payagent to origin/main.
# Also safe to run by hand: sudo /opt/payagent/deploy/deploy.sh
set -euo pipefail
cd "$(dirname "$0")/.."

if [ ! -f .env ]; then
  echo "No .env in $(pwd). Copy it to the server before deploying." >&2
  exit 1
fi

docker compose up -d --build --remove-orphans
docker image prune -f >/dev/null
docker compose ps
