-- Class OS initial schema. Single-owner app: every row is tied to an auth user
-- and every policy checks auth.uid() = owner_id.

create extension if not exists "pgcrypto";

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  code text not null,
  title text not null,
  instructor text,
  color text not null,
  calendar_event_series_id text,
  aliases text[] not null default '{}',
  term text not null,
  generation_notes text,
  created_at timestamptz not null default now(),
  unique (owner_id, code, term)
);

create table public.lectures (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
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
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  lecture_id uuid not null references public.lectures (id) on delete cascade,
  title text not null,
  summary text,
  est_minutes integer,
  spec jsonb not null,
  schema_version integer not null default 1,
  created_at timestamptz not null default now()
);

create table public.concepts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  name text not null,
  first_lesson_id uuid references public.lessons (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (course_id, name)
);

create table public.attempts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  block_id text not null,
  answer jsonb,
  correct boolean not null,
  created_at timestamptz not null default now()
);

create index lectures_course_idx on public.lectures (course_id);
create index lessons_lecture_idx on public.lessons (lecture_id);
create index concepts_course_idx on public.concepts (course_id);
create index attempts_lesson_idx on public.attempts (lesson_id);
create index attempts_wrong_idx on public.attempts (owner_id, created_at desc) where not correct;

-- Row level security: owner only, for every table and every command.
alter table public.courses enable row level security;
alter table public.lectures enable row level security;
alter table public.lessons enable row level security;
alter table public.concepts enable row level security;
alter table public.attempts enable row level security;

create policy "courses owner" on public.courses
  for all to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

create policy "lectures owner" on public.lectures
  for all to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

create policy "lessons owner" on public.lessons
  for all to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

create policy "concepts owner" on public.concepts
  for all to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

create policy "attempts owner" on public.attempts
  for all to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);
