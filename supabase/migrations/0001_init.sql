-- Class OS schema for an open (no login) v1 site.
-- Reads are public, except lectures.transcript, which anon and authenticated can
-- never read (column-level grants below). The only public write is inserting quiz
-- attempts. The Next.js server action recordAttempt (lib/attempts.ts) is the only
-- code that does it.
-- Writes to courses, lectures, lessons and concepts go through the service role
-- (or the Supabase MCP), which bypasses RLS.

create extension if not exists "pgcrypto";

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  slug text not null unique,
  title text not null,
  category text not null,
  instructor text,
  schedule text not null,
  color text not null,
  tone text not null default 'light' check (tone in ('light', 'dark')),
  -- Recurring Google Calendar series ids from the " Class Schedule" calendar. Most
  -- courses have one; ECON 106FB has two (lab and Friday lecture).
  calendar_event_series_ids text[] not null default '{}',
  aliases text[] not null default '{}',
  term text not null,
  generation_notes text,
  created_at timestamptz not null default now(),
  unique (code, term)
);

create table public.lectures (
  id uuid primary key default gen_random_uuid(),
  course_id uuid references public.courses (id) on delete set null,
  wispr_meeting_id text not null unique,
  calendar_event_id text,
  starts_at timestamptz,
  ends_at timestamptz,
  transcript text,
  wispr_share_link text,
  status text not null default 'pending'
    check (status in ('pending', 'generated', 'failed', 'unmatched')),
  created_at timestamptz not null default now()
);

create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  lecture_id uuid not null references public.lectures (id) on delete cascade,
  title text not null,
  summary text,
  est_minutes integer,
  spec jsonb not null,
  schema_version integer not null default 1,
  -- Phase 3: the generator can insert drafts and publish after validation.
  status text not null default 'published' check (status in ('draft', 'published')),
  created_at timestamptz not null default now()
);

create table public.concepts (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  name text not null,
  first_lesson_id uuid references public.lessons (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (course_id, name)
);

create table public.attempts (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  block_id text not null check (char_length(block_id) between 1 and 200),
  answer jsonb check (pg_column_size(answer) <= 8192),
  correct boolean not null,
  created_at timestamptz not null default now()
);

-- Phase 6: exams and assignments pulled from Canvas. Written by the service role only.
create table public.assessments (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  kind text not null check (kind in
    ('midterm', 'final', 'quiz', 'problem_set', 'lab', 'case', 'paper', 'assignment')),
  title text not null,
  due_at timestamptz,
  weight numeric check (weight is null or (weight >= 0 and weight <= 100)),
  coverage text,
  format text,
  canvas_url text,
  source text,
  confidence text check (confidence is null or confidence in ('low', 'medium', 'high')),
  created_at timestamptz not null default now(),
  unique nulls not distinct (course_id, title, due_at)
);

create index lectures_course_idx on public.lectures (course_id);
create index lessons_lecture_idx on public.lessons (lecture_id);
create index concepts_course_idx on public.concepts (course_id);
create index concepts_first_lesson_idx on public.concepts (first_lesson_id);
create index assessments_course_due_idx on public.assessments (course_id, due_at);
create index attempts_lesson_idx on public.attempts (lesson_id);
create index attempts_wrong_idx on public.attempts (created_at desc) where not correct;

-- RLS on every table.
alter table public.courses enable row level security;
alter table public.lectures enable row level security;
alter table public.lessons enable row level security;
alter table public.concepts enable row level security;
alter table public.attempts enable row level security;
alter table public.assessments enable row level security;

-- Table privileges: start from nothing, then grant only what the policies allow.
revoke all on public.courses, public.lectures, public.lessons, public.concepts,
  public.attempts, public.assessments from anon, authenticated;
grant select on public.courses, public.lessons, public.concepts, public.assessments
  to anon, authenticated;

-- Transcripts stay private on the open site. Column-level grant: every lectures
-- column except transcript. A `select *` or `select transcript` as anon fails with
-- "permission denied". Queries must list columns. The service role bypasses this.
grant select (id, course_id, wispr_meeting_id, calendar_event_id, starts_at, ends_at,
  wispr_share_link, status, created_at)
  on public.lectures to anon, authenticated;

-- ACCEPTED v1 RISK: anyone with the publishable key can insert attempts without
-- limit (the site has no login). Rows are small (block_id and answer are size-capped)
-- and only feed local progress and review. If abused, the fix is to add auth or a
-- rate limit (for example an edge function in front of the insert).
grant select, insert on public.attempts to anon, authenticated;

create policy "courses public read" on public.courses
  for select to anon, authenticated using (true);
create policy "lectures public read" on public.lectures
  for select to anon, authenticated using (true);
create policy "lessons public read" on public.lessons
  for select to anon, authenticated using (true);
create policy "concepts public read" on public.concepts
  for select to anon, authenticated using (true);
create policy "assessments public read" on public.assessments
  for select to anon, authenticated using (true);
-- No insert, update or delete policy on assessments: anon writes are impossible.

create policy "attempts public read" on public.attempts
  for select to anon, authenticated using (true);
-- The check is not a bare "true": it requires the attempt to point at a real lesson.
create policy "attempts public insert" on public.attempts
  for insert to anon, authenticated
  with check (exists (select 1 from public.lessons l where l.id = lesson_id));
-- No update or delete policies exist, so anon and authenticated cannot do either.
