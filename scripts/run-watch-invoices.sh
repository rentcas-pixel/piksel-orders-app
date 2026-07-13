#!/bin/bash
# Paleidžia sąskaitų stebėtoją (naudojama launchd fone).
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"
cd "$(dirname "$0")/.." || exit 1
exec ./node_modules/.bin/tsx scripts/watch-received-invoices.ts
