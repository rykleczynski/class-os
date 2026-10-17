---
description: Build a detailed exam review (midterm or final) for one course from every lesson and transcript in scope
argument-hint: <course slug> <exam title>, e.g. econ-134 "Midterm 1"
---

Build the exam review for: $ARGUMENTS

The result is `content/reviews/<slug>/review.json` (gitignored, never committed: the repo is public), shown at
`/review/<slug>` and linked from the course page and the dashboard. Slug: `<course prefix>-<exam>`, for example
`econ134-midterm-1` or `econ106f-final`.

## 1. Find the scope

The scope is what the syllabus says the exam covers plus anything said in class. Settle these before writing:
the exam date and time, the first and last lecture covered, format and allowed aids, and anything explicitly
pushed past the exam.

- Run `npm run review:bundle -- --course <course slug> --slug <slug> --title "<exam title>" --from <first lecture> --to <last lecture>`.
  Start with `--from` at the first lecture of the term; rerun with a tighter window once you know the scope.
- Read `content/reviews/<slug>/sources/README.md`. Its "What was said about exams" section lists every transcript
  line that mentions exams, with context. The professor often states the scope in the last lecture before the exam.
- If the README lists course files, read the syllabus for the exam policy and coverage. If it says the course
  opted out (`materials_allowed: false`, for example ECON 134), never read `materials/<course>/`: the scope
  comes from lecture only, and `exam.scope.gaps` says so.
- If the date or scope is still unknown, ask Ryan. Do not guess an exam date: leave `startsAt` null.

## 2. Draft in parts

The contract is `lib/review/schema.ts`; blocks are the lesson kit in `lib/lesson/schema.ts`.
`lib/review/assemble.ts` describes the two kinds of file you write:

- `content/reviews/<slug>/parts/<nn>-<topic>.json`: one or more sections with their practice questions,
  flashcards, self-check items and notes-sheet blocks. Read every transcript in scope in full, in chunks (tool
  output truncates silently), not only the lesson digests. One part per one or two lectures keeps each write
  small. Independent parts can be drafted by parallel subagents given the same brief.
- `content/reviews/<slug>/frame.json`: the exam facts and scope with quoted evidence, the study plan from today to
  the exam, the big picture, cross-topic connections, cross-topic practice questions, practice exam
  instructions, minutes and question order, and the notes-sheet allowance and number of sides.

Check each part as you go: `npm run validate:review -- --part <file>`.

Depth bar, per section: a full summary in the professor's framing and notation; every defined term; every model,
condition and estimating equation (for an estimating equation: what the coefficient means, what variation
identifies it, the threat); one to three visuals; two to four worked problems with every number checked by a
script; pitfalls; intact professor quotes that show emphasis; four to six exam-level checks; a weight (high,
medium, low) with the reason. Practice questions are multi-part, exam style, with a full model answer per part
and a rubric, including at least one setting not worked in class.

Honesty: everything traces to the sources. Quote only caption lines that survive intact (fix garbled domain terms
only). Drop numbers that cannot be reconciled. Say when an example is illustrative.

## 3. Assemble, check, publish

1. `npm run review:assemble -- <slug>` writes `review.json` only if it passes the schema and block checks. Fix every
   warning it prints (answer-length tells, a high-weight section without a practice question, an in-scope lecture
   no section uses).
2. Look at it: `npm run dev`, open `/review/<slug>`, and click through every tab.
3. `npm run review:sync -- --only <slug>` uploads it (needs `SUPABASE_SECRET_KEY` and migration `0006_reviews.sql`).

Rebuild after new lectures: rerun the bundle, update the affected parts, assemble and sync again. Self-check ticks and
practice answers live in Ryan's browser and survive a rebuild as long as section ids, self-check wording and
question ids stay the same, so keep them stable.
