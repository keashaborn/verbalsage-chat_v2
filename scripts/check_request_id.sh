#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "Checking request-id propagation in API routes..."

FAIL=0

# Any route that references BRAINS must include x-request-id
while IFS= read -r file; do
  if ! rg -q 'x-request-id' "$file"; then
    echo "❌ Missing x-request-id in: $file"
    FAIL=1
  fi
done < <(
  rg -l 'BRAINS_URL|const BRAINS\b|process\.env\.BRAINS_URL' \
    "$ROOT/app/api" --glob '**/route.ts'
)

if [[ "$FAIL" -eq 1 ]]; then
  echo
  echo "Auditability check FAILED."
  exit 1
fi

echo "✅ Auditability check passed."
