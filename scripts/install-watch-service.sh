#!/bin/bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
RUN_SCRIPT="$PROJECT_DIR/scripts/run-watch-invoices.sh"
LOG_DIR="$HOME/Library/Logs"
PLIST_DEST="$HOME/Library/LaunchAgents/lt.piksel.watch-invoices.plist"
UID_NUM="$(id -u)"

chmod +x "$RUN_SCRIPT"
mkdir -p "$LOG_DIR" "$HOME/Library/LaunchAgents"

sed \
  -e "s|__PROJECT_DIR__|$PROJECT_DIR|g" \
  -e "s|__RUN_SCRIPT__|$RUN_SCRIPT|g" \
  -e "s|__LOG_DIR__|$LOG_DIR|g" \
  "$PROJECT_DIR/scripts/lt.piksel.watch-invoices.plist.template" > "$PLIST_DEST"

# Sustabdyti rankinius stebėtojus
"$PROJECT_DIR/node_modules/.bin/tsx" "$PROJECT_DIR/scripts/stop-watch-invoices.ts" 2>/dev/null || true

launchctl bootout "gui/$UID_NUM" "$PLIST_DEST" 2>/dev/null || true
launchctl bootstrap "gui/$UID_NUM" "$PLIST_DEST"
launchctl enable "gui/$UID_NUM/lt.piksel.watch-invoices" 2>/dev/null || true
launchctl kickstart -k "gui/$UID_NUM/lt.piksel.watch-invoices"

echo "✅ Sąskaitų stebėtojas įdiegtas kaip fono paslauga."
echo "   Veiks visą laiką (net po Mac perkrovimo)."
echo "   Žurnalas: $LOG_DIR/piksel-watch-invoices.log"
echo ""
echo "Naudingos komandos:"
echo "   npm run uninstall:watch-service  — pašalinti"
echo "   tail -f ~/Library/Logs/piksel-watch-invoices.log  — stebėti logą"
