-- ============================================================
-- docs/sql/help_chat_rate_limit.sql
-- Makes /api/help-chat rate limiting a real global cap.
--
-- checkIpRateLimit() (src/lib/imotara/ipRateLimit.ts) is an in-memory Map —
-- on Vercel's multi-instance serverless, each warm lambda has its own
-- counter, so the effective limit was rate_limit × (number of warm
-- instances), not a precise per-IP cap. This matters more here than for the
-- other public routes already using that helper (careers/apply, blog
-- comments), since this endpoint spends real OpenAI tokens per request. This
-- table + function make it a single, atomic, row-locked counter shared
-- across every instance, same pattern as check_api_key_rate_limit().
--
-- Run in Supabase SQL Editor.
-- ============================================================

create table if not exists help_chat_rate_limits (
  ip_key       text        primary key,
  window_start timestamptz not null default now(),
  count        integer     not null default 0
);

alter table help_chat_rate_limits enable row level security;
-- No policies — this table is only ever touched via the service-role-only
-- function below; anon/authenticated get default-deny.

create or replace function check_help_chat_rate_limit(p_ip_key text, p_limit integer, p_window_seconds integer)
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
  insert into help_chat_rate_limits (ip_key, window_start, count)
    values (p_ip_key, v_now, 0)
    on conflict (ip_key) do nothing;

  -- Row lock prevents two concurrent requests from the same IP both reading
  -- a stale count and both being allowed through.
  select window_start, count into v_window_start, v_count
    from help_chat_rate_limits
    where ip_key = p_ip_key
    for update;

  if v_now - v_window_start >= (p_window_seconds || ' seconds')::interval then
    update help_chat_rate_limits
      set window_start = v_now, count = 1
      where ip_key = p_ip_key;
    return true;
  end if;

  if v_count >= p_limit then
    return false;
  end if;

  update help_chat_rate_limits
    set count = count + 1
    where ip_key = p_ip_key;
  return true;
end;
$$;

revoke execute on function check_help_chat_rate_limit from public, anon, authenticated;
grant  execute on function check_help_chat_rate_limit to service_role;

-- Housekeeping: this table grows one row per unique IP ever seen (unlike
-- api_key_rate_limits, which is bounded by the small number of provisioned
-- API keys). Prune old rows periodically, e.g.:
--   delete from help_chat_rate_limits where window_start < now() - interval '1 day';
