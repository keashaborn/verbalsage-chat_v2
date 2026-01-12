#!/usr/bin/env bash
set -euo pipefail

URL="${1:-http://127.0.0.1:3010/}"

sudo systemctl restart verbalsage-v2.service

# Wait up to ~20s for Next to accept requests
for i in {1..80}; do
  if curl -fsS "$URL" >/dev/null; then
    echo "ready: $URL"
    exit 0
  fi
  sleep 0.25
done

echo "timeout waiting for: $URL" >&2
exit 1
