-- Practice exams the app generates from a review's past exams (lib/review/generate.ts). Written by the owner-only
-- server action with the service role; never shared. One row per generated exam; spec is a practiceSetSchema.

create table public.generated_exams (
  id uuid primary key default gen_random_uuid(),
  review_slug text not null references public.reviews (slug) on delete cascade on update cascade,
  spec jsonb not null,
  created_at timestamptz not null default now()
);

create index generated_exams_review_idx on public.generated_exams (review_slug, created_at desc);

alter table public.generated_exams enable row level security;
-- No policies and no grants for anon or authenticated: only the service role can touch this table.
revoke all on public.generated_exams from anon, authenticated;
grant select, insert, update, delete on public.generated_exams to service_role;

-- Rollback: drop table public.generated_exams;
