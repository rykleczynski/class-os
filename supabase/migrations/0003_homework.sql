-- Passcode-gated homework study pages (/homework/<slug>).
-- The repo is public and the site has no login, but problem sets are copyrighted ("may not be
-- shared, uploaded, or distributed") and some syllabi restrict AI use of course content. So the
-- problem text and sample answers live only in this database, never in git, and anon can never
-- read them directly:
--   * homework_sets and homework_answers have RLS on, no policies and no grants for anon or
--     authenticated. A direct select through the publishable key fails.
--   * The app reads and writes only through homework_get and homework_save, security definer
--     functions that check the passcode against a bcrypt hash (pgcrypto, in the extensions schema)
--     before returning or changing anything.
--   * Sets are written by scripts/homework-sync.ts through homework_upsert, which only the
--     service role can execute. It never touches answers.
--
-- ACCEPTED RISK: anyone can call homework_get with guesses, so the passcode can be brute-forced
-- through the RPC (bcrypt slows each guess but there is no rate limit). Use a long random
-- passcode (homework-sync refuses anything under 16 characters). If that is ever not enough, put
-- an edge function with a rate limit in front, or add auth.

create table public.homework_sets (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (char_length(slug) between 1 and 80),
  course_id uuid not null references public.courses (id) on delete cascade,
  title text not null,
  due_at timestamptz,
  -- Validated by lib/homework-spec.ts before upload and again when the page reads it.
  spec jsonb not null,
  -- extensions.crypt(passcode, extensions.gen_salt('bf')). The passcode itself is never stored.
  passcode_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.homework_answers (
  set_id uuid not null references public.homework_sets (id) on delete cascade,
  module_id text not null check (char_length(module_id) between 1 and 40),
  answer text not null default '' check (char_length(answer) <= 20000),
  status text check (status is null or status in ('got', 'review')),
  updated_at timestamptz not null default now(),
  primary key (set_id, module_id)
);

create index homework_sets_course_idx on public.homework_sets (course_id);

alter table public.homework_sets enable row level security;
alter table public.homework_answers enable row level security;

-- No policies and no grants: anon and authenticated cannot touch either table directly.
revoke all on public.homework_sets, public.homework_answers from anon, authenticated;

-- Returns the set and Ryan's saved answers, or null for an unknown slug or a wrong passcode.
create or replace function public.homework_get(p_slug text, p_passcode text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_set public.homework_sets%rowtype;
  v_course public.courses%rowtype;
begin
  if p_slug is null or p_passcode is null
    or char_length(p_slug) > 80 or char_length(p_passcode) > 200 then
    return null;
  end if;
  select * into v_set from public.homework_sets where slug = p_slug;
  if not found or extensions.crypt(p_passcode, v_set.passcode_hash) <> v_set.passcode_hash then
    return null;
  end if;
  select * into v_course from public.courses where id = v_set.course_id;
  return jsonb_build_object(
    'slug', v_set.slug,
    'title', v_set.title,
    'due_at', v_set.due_at,
    'course_code', v_course.code,
    'course_slug', v_course.slug,
    'spec', v_set.spec,
    'answers', coalesce((
      select jsonb_agg(jsonb_build_object(
        'module_id', a.module_id,
        'answer', a.answer,
        'status', a.status,
        'updated_at', a.updated_at
      ) order by a.module_id)
      from public.homework_answers a
      where a.set_id = v_set.id
    ), '[]'::jsonb)
  );
end;
$$;

-- Upserts one answer. False on a wrong passcode, an unknown module or out-of-range input.
create or replace function public.homework_save(
  p_slug text,
  p_passcode text,
  p_module_id text,
  p_answer text,
  p_status text default null
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_set public.homework_sets%rowtype;
begin
  if p_slug is null or p_passcode is null or p_module_id is null or p_answer is null
    or char_length(p_slug) > 80 or char_length(p_passcode) > 200
    or char_length(p_module_id) not between 1 and 40
    or char_length(p_answer) > 20000
    or (p_status is not null and p_status not in ('got', 'review')) then
    return false;
  end if;
  select * into v_set from public.homework_sets where slug = p_slug;
  if not found or extensions.crypt(p_passcode, v_set.passcode_hash) <> v_set.passcode_hash then
    return false;
  end if;
  -- Only modules that exist in the spec, so a passcode holder cannot add arbitrary rows.
  if not exists (
    select 1 from jsonb_array_elements(v_set.spec -> 'modules') m where m ->> 'id' = p_module_id
  ) then
    return false;
  end if;
  insert into public.homework_answers (set_id, module_id, answer, status, updated_at)
  values (v_set.id, p_module_id, p_answer, p_status, now())
  on conflict (set_id, module_id) do update
    set answer = excluded.answer, status = excluded.status, updated_at = excluded.updated_at;
  return true;
end;
$$;

-- Creates or replaces a set and its passcode. Service role only (scripts/homework-sync.ts).
-- Saved answers are kept: they belong to module ids, not to the spec text.
create or replace function public.homework_upsert(
  p_slug text,
  p_course_code text,
  p_title text,
  p_due_at timestamptz,
  p_spec jsonb,
  p_passcode text
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_course_id uuid;
  v_id uuid;
begin
  if p_passcode is null or char_length(p_passcode) < 16 then
    raise exception 'passcode must be at least 16 characters';
  end if;
  if jsonb_typeof(p_spec -> 'modules') is distinct from 'array' then
    raise exception 'spec.modules must be an array';
  end if;
  -- courses is unique on (code, term); take the newest term for this code.
  select id into v_course_id from public.courses
    where code = p_course_code order by created_at desc limit 1;
  if v_course_id is null then
    raise exception 'no course with code %', p_course_code;
  end if;
  insert into public.homework_sets (slug, course_id, title, due_at, spec, passcode_hash)
  values (p_slug, v_course_id, p_title, p_due_at, p_spec,
    extensions.crypt(p_passcode, extensions.gen_salt('bf')))
  on conflict (slug) do update
    set course_id = excluded.course_id,
        title = excluded.title,
        due_at = excluded.due_at,
        spec = excluded.spec,
        passcode_hash = excluded.passcode_hash,
        updated_at = now()
  returning id into v_id;
  return v_id;
end;
$$;

-- Supabase grants EXECUTE on new public functions to anon and authenticated by default. Start from
-- nothing, then open only the two passcode-checked entry points.
revoke execute on function public.homework_get(text, text) from public, anon, authenticated;
revoke execute on function public.homework_save(text, text, text, text, text) from public, anon, authenticated;
revoke execute on function public.homework_upsert(text, text, text, timestamptz, jsonb, text)
  from public, anon, authenticated;

grant execute on function public.homework_get(text, text) to anon, authenticated;
grant execute on function public.homework_save(text, text, text, text, text) to anon, authenticated;
grant execute on function public.homework_upsert(text, text, text, timestamptz, jsonb, text) to service_role;
