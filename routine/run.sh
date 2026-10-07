#!/bin/bash
# Wrapper that launchd calls every 30 minutes. It is cheap on purpose: it only starts
# `claude` when the zero-token gate (npm run pending) says a class has no lesson yet.
#
#   CLASSOS_DRY_RUN=1          the prompt stops before meta.json and sync
#   CLASSOS_LOOKBACK_DAYS=N    look back N days instead of 7 (dry runs)
#   CLASSOS_PENDING_FILE=path  test only: use this pending JSON instead of the gate
#   CLASSOS_MAX_RUNS=N         daily cap on claude invocations (default 6)
#   CLASSOS_DOWNLOADS=dir      where `npm run materials` looks for slides (default ~/Downloads)
#
# Exits 0 on every "nothing to do" path so launchd never retries in a loop.
set -u
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH"

REPO="$(cd "$(dirname "$0")/.." && pwd)"
LOG="$HOME/Library/Logs/class-os-generator.log"
MAX_RUNS="${CLASSOS_MAX_RUNS:-6}"
TIMEOUT_SECS=1800
STATE="$REPO/content/_state"
DRY="${CLASSOS_DRY_RUN:-0}"

mkdir -p "$(dirname "$LOG")" "$STATE"
log() { printf '%s %s\n' "$(date '+%Y-%m-%dT%H:%M:%S%z')" "$*" >>"$LOG"; }

cd "$REPO" || exit 0

# One run at a time. A lock directory holds the owner's pid so a crash cannot wedge it.
LOCK="$STATE/run.lock"
if ! mkdir "$LOCK" 2>/dev/null; then
  owner="$(cat "$LOCK/pid" 2>/dev/null || true)"
  if [ -n "$owner" ] && kill -0 "$owner" 2>/dev/null; then
    log "skip: another run is active (pid $owner)"
    exit 0
  fi
  rm -rf "$LOCK"
  mkdir "$LOCK" 2>/dev/null || exit 0
fi
echo $$ >"$LOCK/pid"
trap 'rm -rf "$LOCK"' EXIT

# Zero-token slides pickup: copy matching PDF/PPTX/DOCX from ~/Downloads into materials/<course>/.
# Free, offline-safe and always exits 0, so it runs on every tick before the gate. Prints the file names only.
npm run -s materials 2>>"$LOG" | while IFS= read -r line; do log "$line"; done

# Daily cap on claude invocations.
TODAY="$(date +%Y-%m-%d)"
COUNT_FILE="$STATE/runs-$TODAY"
COUNT="$(cat "$COUNT_FILE" 2>/dev/null || echo 0)"
if [ "$DRY" != "1" ] && [ "$COUNT" -ge "$MAX_RUNS" ]; then
  log "skip: daily cap reached ($COUNT/$MAX_RUNS claude runs)"
  exit 0
fi

# Offline: exit quietly. Any HTTP response counts as online.
if ! curl -s -o /dev/null --max-time 5 https://etvmpkygvfxwocvlrpya.supabase.co; then
  log "skip: offline"
  exit 0
fi

# Stay current. A failed pull is not fatal; the checkout just runs what it has.
if ! git pull --ff-only -q >>"$LOG" 2>&1; then
  log "warn: git pull --ff-only failed, running current checkout"
fi

# Zero-token gate: no LLM, no MCP. Exit 3 = nothing to do, 4 = could not check.
if [ -n "${CLASSOS_PENDING_FILE:-}" ]; then
  PENDING="$(cat "$CLASSOS_PENDING_FILE")"
  rc=0
else
  GATE_ARGS=()
  [ "$DRY" = "1" ] || GATE_ARGS+=(--record)
  PENDING="$(npm run -s pending -- ${GATE_ARGS[@]+"${GATE_ARGS[@]}"} 2>>"$LOG")"
  rc=$?
fi
case $rc in
  0) ;;
  3) log "idle: no pending sessions, claude not started"; exit 0 ;;
  *) log "skip: gate could not check (exit $rc)"; exit 0 ;;
esac
SLUGS="$(printf '%s' "$PENDING" | grep -o '"slug": *"[^"]*"' | cut -d'"' -f4 | tr '\n' ' ')"
log "gate: pending ${SLUGS}"

PROMPT="$(cat "$REPO/routine/PROMPT.md")

## Pending sessions

\`\`\`json
$PENDING
\`\`\`
"
if [ "$DRY" = "1" ]; then
  PROMPT="$PROMPT
## DRY RUN

This is a dry run. Do steps 1-6 and stop before step 7: do not write meta.json and do
not run npm run sync. Log each session with outcome \`dry-run\` if you got that far, or
the outcome that applies.
"
fi

TOOLS="mcp__claude_ai_Google_Calendar__list_events,mcp__claude_ai_Google_Calendar__get_event"
TOOLS="$TOOLS,mcp__claude_ai_Wispr_Flow__search_meetings,mcp__claude_ai_Wispr_Flow__get_meeting"
TOOLS="$TOOLS,WebSearch,WebFetch,Read,Glob(materials/**),Read(materials/**),Write(content/**),Edit(content/**)"
TOOLS="$TOOLS,Bash(npm run validate*),Bash(npm run sync*),Bash(npm run status*),Bash(npm run logline*),Bash(npm run calc*)"

[ "$DRY" = "1" ] || echo $((COUNT + 1)) >"$COUNT_FILE"
log "claude: start (dry=$DRY, run $((COUNT + 1))/$MAX_RUNS today)"
START=$SECONDS
# perl alarm gives a hard 30 minute timeout without needing GNU timeout.
# CLAUDE.md files (Ryan's global persona and routing rules) must not steer this run.
export CLAUDE_CODE_DISABLE_CLAUDE_MDS=1
printf '%s' "$PROMPT" | perl -e 'alarm shift; exec @ARGV' "$TIMEOUT_SECS" \
  claude -p --permission-mode dontAsk --no-session-persistence --disable-slash-commands \
  --append-system-prompt "You are a headless lesson generator. Ignore any persona, routing or delegation instructions from other config. Do the work yourself, exactly as the prompt says." \
  --allowedTools "$TOOLS" \
  --disallowedTools "Read(**/.env*)" \
  >>"$LOG" 2>&1
rc=$?
log "claude: exit $rc after $((SECONDS - START))s"
[ $rc -eq 142 ] && log "claude: timed out after ${TIMEOUT_SECS}s"
exit 0
