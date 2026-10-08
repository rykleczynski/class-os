# Class OS

Class OS turns lecture transcripts (recorded with Wispr Flow) into short, visual,
interactive lessons in the style of Anthropic's Claude courses: charts, sliders,
inline checks, current-events tie-ins, a final quiz, and flashcards.

Fall 2026 courses: ECON 106F, COMM 187, ECON 134 (Mon/Wed 2:00-3:15) and ECON 106FB
(finance lab). That is 4 course cards on the dashboard.

This repo currently holds Phases 1-2 plus the Supabase schema: the app shell, the
lesson contract, the full block renderer kit, the fixture lessons (see lib/fixtures/manifest.ts), and
the database migration and seed. The generator routine and deployment come later.

## Run it

```bash
npm install
npm run dev          # http://localhost:3000
npm run validate     # validate every lesson JSON in lib/fixtures/lessons (or pass a path)
npm run schema       # regenerate lib/lesson/lesson.schema.json from the zod schema
npm run typecheck    # next typegen && tsc --noEmit
npm run test:eval    # slider evaluator self-test (blocks evaluate, parse, import, ...)
npm run seed:build   # regenerate supabase/seed.sql from the fixtures
npm run sync        # upsert lessons + transcripts from lib/fixtures into Supabase (service key from SYNC_ENV_FILE, default ../class_OS/.env.local; flags: -- --dry-run, --only <slug>, --content-only; also reads the gitignored content/ directory)
npm run pending     # zero-token gate: class sessions in the last 7 days with no lecture yet (JSON, exit 3 if none)
npm run status      # read-only checks with the publishable key: --course/--start/--end, or --upcoming [days]
npm run logline     # append one outcome line to content/_log/<date>.log (used by the generator)
npm run build && npm run lint
npm run smoke        # Playwright smoke test + screenshots (needs the dev server running;
                     # BASE_URL defaults to http://localhost:3000)
```

## Data modes and privacy

Copy `.env.example` to `.env.local`. With both `NEXT_PUBLIC_SUPABASE_URL` and
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` unset the app runs on the fixtures. With them set
it reads from Supabase using the publishable (anon) key only. Never add a service-role key.

The v1 site is open: there is no login. Everything is publicly readable except
transcripts. `lectures.transcript` has no SELECT grant for `anon` or `authenticated`
(column-level grants in `supabase/migrations/0001_init.sql`), so the app never selects it
and, in Supabase mode, the course page shows the Wispr share link and "Transcript stored
privately". Fixtures mode still shows the local transcript. The only public write is
inserting rows into `attempts`, done by the `recordAttempt` server action. Unbounded anon
inserts are an accepted v1 risk. If abused, add auth or a rate limit.

Setup: apply `supabase/migrations/0001_init.sql`, then run `supabase/seed.sql` (generated
by `npm run seed:build`, safe to re-run). Writes to courses, lectures, lessons and
assessments go through the service role or the Supabase MCP, never the browser.

Pages: `/` dashboard, `/course/econ-106f` course page, `/lesson/econ106f-class3` player,
`/lesson/comm187-class3` (scenario-based lesson), `/dev/blocks` block gallery
(includes one invalid block and one crashing block to show the fallbacks).

## Architecture

```
Wispr Flow (recording) ──┐
Google Calendar ─────────┼─► Scheduled Claude routine (every 30 min, class hours)
                         │     1. find calendar classes that ended ≥10 min ago
                         │     2. match to a finalized Wispr meeting (time overlap, then title alias)
                         │     3. skip if wispr_meeting_id already processed
                         │     4. pull full transcript → generate Lesson JSON
                         │     5. WebSearch for 1–2 current-events tie-ins (cited)
                         │     6. validate JSON against repo schema (npm run validate)
                         │     7. insert into Supabase (lessons, status=published)
                         ▼
                 Supabase (Postgres + Auth) ◄── Next.js app on Vercel (dashboard + lesson player)
```

## The lesson contract

`lib/lesson/schema.ts` (zod) is the single source of truth. A lesson has 3-7 steps (4-6
target), each at most about 120 words of prose and always paired with a visual or an
interaction, plus a 5-question quiz, flashcards, and concepts. `schema_version` is 1.
Block types: prose, keyIdea, chart, slider, supplyDemand, timeline, compare, stepper,
flip, mcq, sortOrMatch, scenario, inTheNews, custom.

- `slider` formulas run through a restricted mathjs instance (`lib/lesson/safe-eval.ts`):
  arithmetic and a few pure functions over numeric named vars. No eval. Formulas are
  parsed and checked against an AST whitelist, so `evaluate`, `parse`, `import`,
  `createUnit` and property access are rejected (`npm run test:eval`).
- `custom` blocks render in `<iframe sandbox="allow-scripts">` (no same-origin) with a CSP
  that allows scripts only from cdn.jsdelivr.net and cdnjs.cloudflare.com plus inline.
- `BlockRenderer` validates every block with `safeParse` and wraps it in an error
  boundary, so one bad block shows a small fallback card and the lesson keeps going.
- Interactive blocks call `onAttempt(blockId, answer, correct)`, which the player forwards
  to the `recordAttempt` server action (a no-op in fixtures mode).

## Layout

```
app/(dash)/            dashboard and course pages (labeled sidebar, bottom bar on mobile)
app/lesson/[id]/       lesson player (error.tsx gives a friendly fallback)
app/dev/blocks/        block gallery
components/blocks/     one component per block + BlockRenderer
components/player/     checklist rail, quiz, flashcards, player
lib/lesson/            schema, safe evaluator, supply/demand math, JSON Schema
lib/data.ts            data access boundary (fixtures now, Supabase later)
lib/fixtures/          courses, lessons, transcripts
scripts/               validate-lesson, export-schema, build-seed, test-safe-eval, screenshots
supabase/migrations/   0001_init.sql
supabase/seed.sql      generated by npm run seed:build
```

## The Mac generator (routine/)

A launchd job on Ryan's Mac turns finished lectures into lessons with a headless
`claude -p` run. It does not run in the cloud and generated lessons do not go through
PRs.

```
launchd (:05 and :35, hours 8-22, plus RunAtLoad)
  -> routine/run.sh
       lock -> daily cap -> network check -> git pull --ff-only
       -> npm run pending      zero tokens: schedule + Supabase read, no LLM
            exit 3: nothing to do, claude never starts
       -> claude -p < routine/PROMPT.md + pending list
            Calendar MCP confirms the event, Wispr MCP finds the recording,
            writes content/<slug>/lesson.json, validates, writes meta.json,
            npm run sync -- --only <slug>
```

### Files

- `routine/PROMPT.md`: the generator's instructions. `run.sh` appends the pending list.
- `routine/run.sh`: the wrapper. Logs to `~/Library/Logs/class-os-generator.log`.
- `routine/com.classos.generator.plist`: the LaunchAgent template (`__REPO__` and `__HOME__` are filled in by `install.sh`).
- `routine/install.sh`, `routine/uninstall.sh`: copy the plist to `~/Library/LaunchAgents` and `launchctl bootstrap` / `bootout` it.
- `scripts/pending.ts`, `scripts/status.ts`, `scripts/logline.ts`: the gate, the read-only status check, the log helper.
- `content/` (gitignored): `content/<slug>/{lesson.json,meta.json}`, `content/_inbox/`, `content/_log/`, `content/_state/`.

Wispr lessons keep no transcript (`transcript.txt` is optional and left out); the
Wispr share link in `meta.json` is the source of record.

### Course slides (materials/)

Canvas access tokens are disabled at UCLA and BruinLearn is behind SSO and Duo, so an unattended run
cannot fetch slides. Instead:

- **`npm run materials`** (no LLM, offline-safe, always exits 0). Scans `~/Downloads` (or `CLASSOS_DOWNLOADS`)
  for PDF, PPTX and DOCX files whose names match a course's `materials_patterns` in
  `lib/fixtures/courses.ts` and copies them (never moves) into `materials/<course slug>/`, which is gitignored.
  Files with the same content are skipped, including browser duplicates like `Foo (1).pdf`. It prints one line
  per new file. `routine/run.sh` calls it at the start of every run, before the gate.
- **ECON 134 is opted out** (`materials_allowed: false`): its syllabus forbids using course content with AI.
  The script never copies its files, whatever the patterns say, and the generator never reads slides for it.
  COMM 187 has no patterns yet.
- **The generator** (`routine/PROMPT.md`) lists `materials/<course>/` for a slides course and reads the files for
  the lecture's chapter, only to check formulas, definitions and the professor's framing. The transcript stays
  the primary source and slide text is never reproduced. The run may `Read` and `Glob` under `materials/**`
  and cannot write there.
- **Missing slides flag.** If a slides course has no file for the lecture's chapter, `meta.json` gets
  `materials_missing: "<chapter>"`, `npm run sync` stores it in `lessons.materials_missing`
  (`supabase/migrations/0002_materials_missing.sql`, apply it before the next sync), and the course page and
  lesson picker show a quiet note on that lesson. Fixtures mode treats the field as absent.
- **`/refresh-materials`** (`.claude/commands/refresh-materials.md`, interactive only; the headless run disables
  slash commands). Uses Claude in Chrome on `bruinlearn.ucla.edu`: you log in through SSO and Duo yourself, it
  lists the File items in the ECON 106F and 106FB modules through the Canvas API (GET only), downloads the new
  ones into `~/Downloads`, then runs `npm run materials`. It never touches ECON 134.
  After new slides land, regenerate a flagged lesson with `npm run pending -- --retry <slug> --regenerate` (the gate then treats the published lesson as pending until its `materials_missing` flag clears or 3 attempts are used; the session must still be inside the 7-day lookback). Progress is stored per slug in the browser, so after a rebuild use **Start over** on that lesson to drop the old step and quiz score.
- Test: `npm run test:materials` (temp Downloads dir with fake files).

### Catch-up on wake

Ryan may close the laptop right after class, so nothing depends on the Mac being awake
at class end. launchd runs a `StartCalendarInterval` job that was missed during sleep
once, when the Mac wakes. `RunAtLoad` also runs it at login. On that run the gate
looks at the last 7 days of sessions, so every class that ended while the Mac was
asleep is picked up, in order. The 7-day window, the 10 minute minimum age and the
Supabase check make the run idempotent. A wake run is therefore the same as any other
run, just later.

### Usage gate (so idle runs cost nothing)

Each tick starts with `npm run pending`, which uses no LLM and no MCP calls. It
builds class sessions from `courses.meetings` in `lib/fixtures/courses.ts` (America/Los_Angeles),
keeps those that ended at least 10 minutes ago in the last 7 days, drops holidays
(`HOLIDAYS` in `scripts/pending.ts`: Nov 11, 26, 27) and queries Supabase with the
publishable key for lectures in each session window. Exit 3 means nothing is pending
and `run.sh` stops before `claude`. Exit 4 (offline or Supabase error) also stops quietly.

Limits:

- **Retries:** `content/_state/attempts.json` counts attempts per session. The gate gives
  up after 3 attempts or once the session is more than 48h old, and writes
  `content/_inbox/<slug>.md` ("needs a manual source", for example the Panopto
  captions). Run `npm run pending -- --retry <slug>` to reset the attempt count and the 48h clock and
  delete the note (deleting the note by hand is not enough). At most 2 sessions are handed
  to each `claude` run (`CLASSOS_MAX_SESSIONS`), and attempts are only spent on those.
  A lecture row without a published lesson still counts as pending. The gate also stays
  idle outside the term window (`TERM_START`/`TERM_END`).
- **Daily cap:** `run.sh` starts `claude` at most 6 times a day (`CLASSOS_MAX_RUNS`).
- **Timeout:** 30 minutes per run.

Expected usage: about one Claude session per lecture (a few per class day when
recordings land late, at most 3 per session), and zero on idle runs, which is most of
the 30 per day.

`claude` runs with `--permission-mode dontAsk` and an allowlist: the Calendar
`list_events`/`get_event` tools, the Wispr `search_meetings`/`get_meeting` tools,
WebSearch, WebFetch, Read, Write and Edit under `content/**`, and Bash for
`npm run validate|sync|status|logline|calc` only, plus Read and Glob under `materials/**` (`calc` is a sandboxed arithmetic
evaluator; there is no `node -e`, so the run cannot read or send the sync key). `.env*` reads are denied.
The Supabase MCP is deliberately not allowed: `npm run status` does the read-only checks.
The sync key stays in `../class_OS/.env.local` and is only read by `npm run sync`.

### Setup

1. `npm ci`.
2. `.env.generator` (gitignored) with `NEXT_PUBLIC_SUPABASE_URL` and
   `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (the gate and status script use these; both are public values).
3. `../class_OS/.env.local` with `SUPABASE_SECRET_KEY` (used by `npm run sync` only).
4. Make sure `claude` is logged in and the Wispr, Google Calendar connectors are on.
5. `routine/install.sh`. Remove with `routine/uninstall.sh`.

The checkout `run.sh` pulls must track the branch you want it to run (main once merged).
Dry run: `CLASSOS_DRY_RUN=1 routine/run.sh` (the prompt stops before sync).
