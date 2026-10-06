#!/bin/bash
# Installs the launchd LaunchAgent that runs routine/run.sh. Run once, after review.
set -euo pipefail
REPO="$(cd "$(dirname "$0")/.." && pwd)"
LABEL=com.classos.generator
DEST="$HOME/Library/LaunchAgents/$LABEL.plist"

for f in .env.generator; do
  [ -f "$REPO/$f" ] || { echo "missing $REPO/$f (publishable Supabase settings); see README" >&2; exit 1; }
done
[ -f "$REPO/../class_OS/.env.local" ] || { echo "missing ../class_OS/.env.local (sync key); see README" >&2; exit 1; }
command -v claude >/dev/null || { echo "claude CLI not on PATH" >&2; exit 1; }

mkdir -p "$HOME/Library/LaunchAgents" "$HOME/Library/Logs"
sed -e "s#__REPO__#$REPO#g" -e "s#__HOME__#$HOME#g" "$REPO/routine/$LABEL.plist" >"$DEST"
plutil -lint "$DEST" >/dev/null

launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$DEST"
echo "installed $DEST"
echo "logs: ~/Library/Logs/class-os-generator.log"
