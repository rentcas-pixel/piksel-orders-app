#!/bin/bash
set -euo pipefail

PLIST_DEST="$HOME/Library/LaunchAgents/lt.piksel.watch-invoices.plist"
UID_NUM="$(id -u)"

if [[ -f "$PLIST_DEST" ]]; then
  launchctl bootout "gui/$UID_NUM" "$PLIST_DEST" 2>/dev/null || true
  rm -f "$PLIST_DEST"
fi

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
"$PROJECT_DIR/node_modules/.bin/tsx" "$PROJECT_DIR/scripts/stop-watch-invoices.ts" 2>/dev/null || true

echo "✅ Fono paslauga pašalinta."
