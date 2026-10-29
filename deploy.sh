#!/bin/sh
# Rebuild and restart the app, then remove what the rebuild left behind: the
# images it replaced (untagged ones only, never the running ones) and build
# cache unused for a week. Without this every rebuild leaves ~0.5 GB behind.
#   ./deploy.sh            everything
#   ./deploy.sh backend    one service
set -e
cd "$(dirname "$0")"
docker compose up -d --build "$@"
docker image prune -f
docker builder prune -f --filter until=168h
