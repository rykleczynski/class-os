-- Set by the Mac generator (via scripts/sync.ts) when it wrote a lesson for a slides course but found
-- no slide file for that lecture's chapter or topic. The app shows a quiet note on the lesson.
-- Null means slides were found, or the course has none. Public read is unchanged: the column is
-- covered by the existing table-level select grant on public.lessons.
alter table public.lessons add column if not exists materials_missing text;
