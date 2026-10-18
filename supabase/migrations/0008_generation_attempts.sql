-- One row per practice-exam generation attempt, reserved before the model is called, so the daily cap counts
-- attempts (failed ones and deleted exams included) and two concurrent requests cannot both pass the check.

create table public.generation_attempts (
  id bigint generated always as identity primary key,
  review_slug text not null,
  created_at timestamptz not null default now()
);

create index generation_attempts_review_idx on public.generation_attempts (review_slug, created_at);

alter table public.generation_attempts enable row level security;
revoke all on public.generation_attempts from anon, authenticated;
grant select, insert on public.generation_attempts to service_role;

-- Reserves one attempt for today (UTC) if fewer than p_cap exist. The transaction-scoped advisory lock on the
-- slug serializes concurrent calls, so the count and the insert cannot interleave.
create function public.reserve_generation(p_slug text, p_cap integer)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtext('classos:generation:' || p_slug));
  if (select count(*) from public.generation_attempts
      where review_slug = p_slug and created_at >= date_trunc('day', now() at time zone 'utc') at time zone 'utc') >= p_cap then
    return false;
  end if;
  insert into public.generation_attempts (review_slug) values (p_slug);
  return true;
end;
$$;

revoke execute on function public.reserve_generation(text, integer) from public, anon, authenticated;
grant execute on function public.reserve_generation(text, integer) to service_role;

-- Rollback: drop function public.reserve_generation(text, integer); drop table public.generation_attempts;
