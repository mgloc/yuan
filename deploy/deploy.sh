#!/usr/bin/env bash
set -euo pipefail

HOST="${1:?usage: deploy/deploy.sh user@host}"
DIR="$(cd "$(dirname "$0")" && pwd)"

ssh "$HOST" 'mkdir -p ~/yuan && (docker network inspect proxy >/dev/null 2>&1 || docker network create proxy)'
scp "$DIR/compose.yml" "$DIR/Caddyfile" "$HOST:~/yuan/"
ssh "$HOST" 'cd ~/yuan && docker compose pull && docker compose up -d --remove-orphans && docker compose exec caddy caddy reload --config /etc/caddy/Caddyfile && docker image prune -f'
