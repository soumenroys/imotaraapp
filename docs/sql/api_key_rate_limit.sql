-- ============================================================
-- docs/sql/api_key_rate_limit.sql
-- Makes /api/v1/org/* API-key rate limiting a real global cap.
--
-- checkApiKeyRateLimit() previously used an in-memory Map (see
-- src/lib/imotara/apiKeyAuth.ts) — on Vercel's multi-instance serverless,
-- each warm lambda has its own counter, so the effective limit was
-- rate_limit × (number of warm instances), not a precise cap. This table +
-- function make it a single, atomic, row-locked counter shared across every
-- instance, matching the pattern already used by assign_org_license() and
-- assign_pool_license() for the same "avoid races across concurrent callers"
-- problem.
--
-- Run in Supabase SQL Editor after org_api_keys.sql.
-- ============================================================

create table if not exists api_key_rate_limits (
  key_id       uuid        primary key references api_keys(id) on delete cascade,
  window_start timestamptz not null default now(),
  count        integer     not null default 0
);

alter table api_key_rate_limits enable row level security;
-- No policies — this table is only ever touched via the service-role-only
-- function below; anon/authenticated get default-deny (matches the RLS
-- lockdown pattern used for admin tables).

create or replace function check_api_key_rate_limit(p_key_id uuid, p_limit integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now          timestamptz := now();
  v_window_start timestamptz;
  v_count        integer;
begin
  insert into api_key_rate_limits (key_id, window_start, count)
    values (p_key_id, v_now, 0)
    on conflict (key_id) do nothing;

  -- Row lock prevents two concurrent requests for the same key from both
  -- reading a stale count and both being allowed through.
  select window_start, count into v_window_start, v_count
    from api_key_rate_limits
    where key_id = p_key_id
    for update;

  if v_now - v_window_start >= interval '60 seconds' then
    update api_key_rate_limits
      set window_start = v_now, count = 1
      where key_id = p_key_id;
    return true;
  end if;

  if v_count >= p_limit then
    return false;
  end if;

  update api_key_rate_limits
    set count = count + 1
    where key_id = p_key_id;
  return true;
end;
$$;

revoke execute on function check_api_key_rate_limit from public, anon, authenticated;
grant  execute on function check_api_key_rate_limit to service_role;
