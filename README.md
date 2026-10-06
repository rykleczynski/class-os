# Class OS

Class OS turns lecture transcripts (recorded with Wispr Flow) into short, visual,
interactive lessons in the style of Anthropic's Claude courses: charts, sliders,
inline checks, current-events tie-ins, a final quiz, and flashcards.

This repo currently holds Phases 1-2: the app shell, the lesson contract, the full
block renderer kit, and two hand-written fixture lessons. Supabase, the generator
routine, and deployment come later.

## Run it

```bash
npm install
npm run dev          # http://localhost:3000
npm run validate     # validate every lesson JSON in lib/fixtures/lessons (or pass a path)
npm run schema       # regenerate lib/lesson/lesson.schema.json from the zod schema
npm run build && npm run lint
npx tsx scripts/screenshots.ts   # smoke test + screenshots (needs the dev server running)
```

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
  arithmetic and a few pure functions over numeric named vars. No eval.
- `custom` blocks render in `<iframe sandbox="allow-scripts">` (no same-origin) with a CSP
  that allows scripts only from cdn.jsdelivr.net and cdnjs.cloudflare.com plus inline.
- `BlockRenderer` validates every block with `safeParse` and wraps it in an error
  boundary, so one bad block shows a small fallback card and the lesson keeps going.
- Interactive blocks call `onAttempt(blockId, answer, correct)`. Nothing is persisted yet.

## Layout

```
app/(dash)/            dashboard and course pages (left icon sidebar)
app/lesson/[id]/       lesson player
app/dev/blocks/        block gallery
components/blocks/     one component per block + BlockRenderer
components/player/     checklist rail, quiz, flashcards, player
lib/lesson/            schema, safe evaluator, supply/demand math, JSON Schema
lib/data.ts            data access boundary (fixtures now, Supabase later)
lib/fixtures/          courses, lessons, transcripts
scripts/               validate-lesson, export-schema, screenshots
supabase/migrations/   0001_init.sql (not applied anywhere yet)
```
