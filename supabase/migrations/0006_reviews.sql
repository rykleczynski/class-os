-- Exam reviews. One row per exam (for example econ134-midterm-1), built from every lesson and
-- transcript in the exam's scope and uploaded by scripts/review-sync.ts with the service role.
-- The app reads them server-side after the owner check in lib/data.ts. Reviews are never shared
-- through /s/<token> links, so there is no guest path and no anon or authenticated access.

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{0,79}$'),
  course_id uuid not null references public.courses (id) on delete cascade,
  title text not null,
  exam_title text not null,
  -- Null when no source stated the exam date.
  exam_at timestamptz,
  spec jsonb not null,
  schema_version integer not null default 1,
  generated_at timestamptz not null,
  updated_at timestamptz not null default now()
);

create index reviews_course_idx on public.reviews (course_id, exam_at);

alter table public.reviews enable row level security;
-- No policies and no grants for anon or authenticated: only the service role can touch this table.
revoke all on public.reviews from anon, authenticated;
grant select, insert, update, delete on public.reviews to service_role;

-- Rollback: drop table public.reviews;
