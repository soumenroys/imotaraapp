-- docs/sql/ip_rate_limits.sql
-- Persistent, atomic, per-IP rate limiting for the AI/TTS-cost-generating
-- routes that had none at all: chat-reply, respond, tts, voice/transcribe,
-- analyze. See ImotaraKnowledgebase / code_review_audit_2026_08_14 (P0-2) —
-- these routes call real OpenAI/Azure APIs with no rate limit whatsoever,
-- and the existing in-memory limiter (src/lib/imotara/ipRateLimit.ts,
-- checkIpRateLimit) resets on cold start and isn't shared across Vercel's
-- multiple warm serverless instances, so it's unsuitable for routes this
-- expensive to abuse (same reasoning that already justified a persistent
-- table for /api/help-chat — see help_chat_rate_limit.sql, whose exact
-- pattern this generalizes rather than duplicates per-route).
--
-- One shared table, keyed by (bucket, ip_key), instead of five near-identical
-- per-route tables — avoids the same kind of drift-prone duplication the
-- audit flagged elsewhere (e.g. the 80/20 split copied across 9 files).
--
-- Run in Supabase SQL Editor.

create table if not exists ip_rate_limits (
  bucket       text        not null,
  ip_key       text        not null,
  window_start timestamptz not null default now(),
  count        integer     not null default 0,
  primary key (bucket, ip_key)
);

alter table ip_rate_limits enable row level security;
-- No policies — this table is only ever touched via the service-role-only
-- function below; anon/authenticated get default-deny.

create or replace function check_bucketed_rate_limit(p_bucket text, p_ip_key text, p_limit integer, p_window_seconds integer)
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
  insert into ip_rate_limits (bucket, ip_key, window_start, count)
    values (p_bucket, p_ip_key, v_now, 0)
    on conflict (bucket, ip_key) do nothing;

  -- Row lock prevents two concurrent requests from the same bucket+IP both
  -- reading a stale count and both being allowed through.
  select window_start, count into v_window_start, v_count
    from ip_rate_limits
    where bucket = p_bucket and ip_key = p_ip_key
    for update;

  if v_now - v_window_start >= (p_window_seconds || ' seconds')::interval then
    update ip_rate_limits
      set window_start = v_now, count = 1
      where bucket = p_bucket and ip_key = p_ip_key;
    return true;
  end if;

  if v_count >= p_limit then
    return false;
  end if;

  update ip_rate_limits
    set count = count + 1
    where bucket = p_bucket and ip_key = p_ip_key;
  return true;
end;
$$;

revoke execute on function check_bucketed_rate_limit from public, anon, authenticated;
-- Per connect_v22's hard-learned lesson: a SECURITY DEFINER function with no
-- explicit GRANT fails every service-role .rpc() call with "permission
-- denied" — silently, in production. Grant explicitly.
grant execute on function check_bucketed_rate_limit to service_role;

-- Verify after running:
-- SELECT has_function_privilege('service_role', 'check_bucketed_rate_limit(text,text,integer,integer)', 'EXECUTE');
-- Expected: 't'

-- Housekeeping: this table grows one row per (bucket, unique IP) ever seen.
-- Prune periodically, e.g.:
--   delete from ip_rate_limits where window_start < now() - interval '1 day';
