#!/usr/bin/env bash
set -euo pipefail

HOST="${1:?usage: deploy/deploy.sh user@host}"
DIR="$(cd "$(dirname "$0")" && pwd)"

ssh "$HOST" 'mkdir -p ~/yuan'
scp "$DIR/compose.yml" "$HOST:~/yuan/compose.yml"
ssh "$HOST" 'cd ~/yuan && docker compose pull && docker compose up -d --remove-orphans && docker image prune -f'
