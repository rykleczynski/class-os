-- Per-course share links. A guest opens /s/<token>; the app hashes the token (sha256, hex) and
-- looks the hash up here with the service role. Only the hash is stored, so a database leak
-- does not leak working links. No anon or authenticated access of any kind.

create table public.share_links (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  -- sha256 of a random 32-byte token, lowercase hex.
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  -- Who it is for ("Riley"). Owner-facing only.
  label text not null check (char_length(label) between 1 and 60),
  created_at timestamptz not null default now(),
  -- Null means it never expires.
  expires_at timestamptz,
  revoked_at timestamptz,
  last_used_at timestamptz,
  use_count integer not null default 0
);

create index share_links_course_idx on public.share_links (course_id, created_at desc);

alter table public.share_links enable row level security;
-- No policies and no grants for anon or authenticated: only the service role can touch this table.
revoke all on public.share_links from anon, authenticated;
grant select, insert, update, delete on public.share_links to service_role;

-- Atomic usage bump, so concurrent visits are not lost. Service role only.
create function public.share_link_touch(p_id uuid)
returns void
language sql
security invoker
set search_path = ''
as $$
  update public.share_links
     set use_count = use_count + 1, last_used_at = now()
   where id = p_id;
$$;

-- Supabase grants EXECUTE on new public functions to anon and authenticated by default.
revoke execute on function public.share_link_touch(uuid) from public, anon, authenticated;
grant execute on function public.share_link_touch(uuid) to service_role;

-- Rollback: drop function public.share_link_touch(uuid); drop table public.share_links;
