-- Private reads. Class OS now reads all content server-side with the service role, after an
-- owner-session or share-token check in the app, so the anon and authenticated roles get nothing.
--
-- BEFORE applying this migration:
--   * SUPABASE_SECRET_KEY (server-only) and OWNER_EMAIL must be set in Vercel, and the
--     app version that reads with the service role must be deployed. Applying it earlier breaks
--     every page on production, which still reads with the publishable key.
--   * scripts/pending.ts and scripts/status.ts (the Mac generator) must run the version that
--     reads with SUPABASE_SECRET_KEY, with that key available to them (see the README).
--
-- What stays public on purpose: the homework RPCs from 0003 (passcode-checked, SECURITY DEFINER,
-- executable by anon). They do not depend on any grant revoked here.
--
-- Rollback (restores the old open-read behavior, so only do it if the app is also rolled back):
--   see "ROLLBACK" at the bottom of this file.

-- Drop the public read/insert policies. With RLS on and no policy, a non-bypass role sees no rows.
drop policy if exists "courses public read" on public.courses;
drop policy if exists "lectures public read" on public.lectures;
drop policy if exists "lessons public read" on public.lessons;
drop policy if exists "concepts public read" on public.concepts;
drop policy if exists "assessments public read" on public.assessments;
drop policy if exists "attempts public read" on public.attempts;
drop policy if exists "attempts public insert" on public.attempts;

-- Revoke the table grants, which also removes the column-level grant on lectures.
-- Attempts can no longer be inserted with the publishable key; the server action writes them for the owner.
revoke all on public.courses, public.lectures, public.lessons, public.concepts,
  public.attempts, public.assessments from anon, authenticated;

-- RLS stays enabled on every table (a table without policies is closed to anon and authenticated).
-- service_role bypasses RLS; be explicit about its table privileges anyway.
grant select, insert, update, delete on public.courses, public.lectures, public.lessons,
  public.concepts, public.attempts, public.assessments to service_role;

-- ROLLBACK (run only together with redeploying the previous app version):
--   grant select on public.courses, public.lessons, public.concepts, public.assessments to anon, authenticated;
--   grant select (id, course_id, wispr_meeting_id, calendar_event_id, starts_at, ends_at,
--     wispr_share_link, status, created_at) on public.lectures to anon, authenticated;
--   grant select, insert on public.attempts to anon, authenticated;
--   create policy "courses public read" on public.courses for select to anon, authenticated using (true);
--   create policy "lectures public read" on public.lectures for select to anon, authenticated using (true);
--   create policy "lessons public read" on public.lessons for select to anon, authenticated using (status = 'published');
--   create policy "concepts public read" on public.concepts for select to anon, authenticated using (true);
--   create policy "assessments public read" on public.assessments for select to anon, authenticated using (true);
--   create policy "attempts public read" on public.attempts for select to anon, authenticated using (true);
--   create policy "attempts public insert" on public.attempts for insert to anon, authenticated
--     with check (exists (select 1 from public.lessons l where l.id = lesson_id));
