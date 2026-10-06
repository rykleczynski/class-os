#!/bin/bash
# Unloads and removes the class-os generator LaunchAgent.
set -euo pipefail
LABEL=com.classos.generator
DEST="$HOME/Library/LaunchAgents/$LABEL.plist"
launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
rm -f "$DEST"
echo "uninstalled $LABEL"
