#!/usr/bin/env bash
# Deploy to the glock.ovh VPS: build the image on GitHub Actions from the pushed
# branch, then pull it on the server. Same script in every app; the shared Caddy,
# which routes the domain here, lives in the vps repository.
#
#   scripts/deploy.sh                              build and deploy latest
#   scripts/deploy.sh --no-build                   redeploy the current latest
#   TAG=sha-abc1234 scripts/deploy.sh --no-build   roll back to an older image
#
# The server keeps its own .env for secrets, which is never synced.
set -euo pipefail

APP=yuan
BRANCH=main
HOST="${DEPLOY_HOST:-ubuntu@glock.ovh}"
TAG="${TAG:-latest}"

cd "$(dirname "$0")/.."

latest_run() {
  gh run list --workflow image.yml --limit 1 --json databaseId -q '.[0].databaseId // 0'
}

if [[ "${1:-}" != "--no-build" ]]; then
  before=$(latest_run)
  gh workflow run image.yml --ref "$BRANCH"
  # The dispatch doesn't return the run, so wait for a newer one to show up.
  for _ in {1..30}; do
    run=$(latest_run)
    [[ "$run" != "$before" ]] && break
    sleep 2
  done
  [[ "$run" != "$before" ]] || { echo "the workflow run didn't start" >&2; exit 1; }
  gh run watch "$run" --exit-status
fi

ssh "$HOST" "mkdir -p $APP"
scp -q compose.vps.yml "$HOST:$APP/compose.vps.yml"
ssh "$HOST" "cd $APP && export TAG=$TAG &&
  docker compose -f compose.vps.yml pull &&
  docker compose -f compose.vps.yml up -d --remove-orphans &&
  docker image prune -f"
