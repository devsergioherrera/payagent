#!/usr/bin/env bash
# One-off setup on a fresh Ubuntu server (EC2: Docker is already installed by user-data). Run as root:
#   curl -fsSL https://raw.githubusercontent.com/devsergioherrera/payagent/main/deploy/bootstrap-vm.sh | sudo bash
set -euo pipefail

REPO=https://github.com/devsergioherrera/payagent.git
DIR=/opt/payagent

command -v docker >/dev/null || curl -fsSL https://get.docker.com | sh
if command -v ufw >/dev/null; then
  ufw allow OpenSSH && ufw allow 80 && ufw allow 443 && ufw --force enable
fi

[ -d "$DIR" ] || git clone "$REPO" "$DIR"
cd "$DIR"
[ -f .env ] || cp .env.example .env

IP=$(curl -fsSL https://api.ipify.org)
echo
echo "Next:"
echo "  1. Edit $DIR/.env with your secrets and set DOMAIN=$IP.sslip.io"
echo "  2. cd $DIR && docker compose up -d --build"
echo "  3. Open https://$IP.sslip.io"
