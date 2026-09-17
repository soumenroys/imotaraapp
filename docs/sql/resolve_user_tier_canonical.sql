-- docs/sql/resolve_user_tier_canonical.sql
--
-- 🔴 THE CANONICAL resolve_user_tier(). Supersedes the copies in
-- org_functions.sql, org_license_management.sql and org_license_pools.sql.
-- Those three are kept as history; this file is the one to apply. (L2 + L3.)
--
-- ── WHAT THIS FIXES (L2) ──────────────────────────────────────────────────────
-- The personal-licence branch never checked expiry. Compare, in the previous
-- version, how the other two branches guard themselves:
--
--   org  branch:  and (o.expires_at is null or o.expires_at > now())   ✓
--   pool branch:  and (p.expires_at is null or p.expires_at > now())   ✓
--   personal   :  elsif v_personal_tier is not null and != 'free'      ✗  no guard
--
-- So a personal licence that lapsed years ago still resolved to its paid tier.
--
-- ⚠️ SCOPE OF THE REAL-WORLD IMPACT — read before assuming this was on fire.
-- /api/license/status already compensates (`isExpired ? "free"`), and that is
-- the endpoint both the web app and the mobile app read and cache. So the tier
-- users SEE has been correct all along. The consumers that do NOT compensate
-- are history/route.ts, chat-reply/route.ts and serverGate.requireFeature —
-- and all three are inert while LICENSE_MODE is "off".
--
-- ⇒ This is a PREREQUISITE for flipping LICENSE_MODE to "enforce", not a live
--   incident. Applying it early is safe and costs nothing; flipping enforce
--   without it would honour dead licences in three places at once.
--
-- NULL expires_at still means permanent, which is what the grandfather backfill
-- writes (tier='pro', status='valid', expires_at=NULL). Unchanged on purpose.
--
-- Status is deliberately NOT part of the condition. 'trial' rows with a future
-- expiry are legitimate and must keep granting; excluding them here would
-- revoke access from real users. Whether status='expired' with a NULL expiry
-- should also fall through is a separate question, and needs a look at live
-- data before anyone answers it.

-- ── tier_rank: `pro` must rank WITH `plus`, not above it ─────────────────────
-- Plus and Pro merged (L10) and `plus` is the canonical id (2026-09-17). The
-- rank function still knew 'pro' as a separate, HIGHER tier, so a stray 'pro'
-- would out-rank a real 'plus' in resolve_user_tier's priority chain. No rows
-- carry 'pro' today — the rename was a zero-row migration — but an in-flight
-- webhook could still write one, and this makes that harmless.

create or replace function tier_rank(t text)
returns integer
language sql
immutable
parallel safe
as $$
  select case t
    when 'free'       then 0
    when 'plus'       then 1
    when 'pro'        then 1   -- legacy alias for 'plus'
    when 'premium'    then 1   -- the mobile spelling, same tier
    when 'family'     then 3
    when 'edu'        then 4
    when 'enterprise' then 5
    else 0
  end;
$$;

create or replace function resolve_user_tier(p_user_id uuid)
returns table (
  effective_tier    text,
  tier_source       text,
  org_id            uuid,
  org_name          text,
  org_role          text,
  override_tier     text,
  expires_at        timestamptz,
  token_balance     integer,
  status            text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_personal_tier     text;
  v_personal_status   text;
  v_personal_expires  timestamptz;
  v_personal_tokens   integer;
  v_personal_org_id   uuid;
  v_personal_live     boolean;
  v_org_tier          text;
  v_org_status        text;
  v_org_expires       timestamptz;
  v_org_name          text;
  v_org_id            uuid;
  v_org_role          text;
  v_override_tier     text;
  v_pool_tier         text;
  v_pool_expires      timestamptz;
begin
  -- 1. Personal license
  select l.tier, l.status, l.expires_at, l.token_balance, l.org_id
    into v_personal_tier, v_personal_status, v_personal_expires, v_personal_tokens, v_personal_org_id
    from licenses l where l.user_id = p_user_id limit 1;

  -- 🔴 THE FIX. Null expiry = permanent; a past expiry no longer grants a tier.
  -- Read the row regardless (token_balance and org_id are still needed) and
  -- decide separately whether the TIER it carries is still live.
  v_personal_live := v_personal_expires is null or v_personal_expires > now();

  -- 2. Org context + per-member override
  if v_personal_org_id is not null then
    select o.id, o.name, o.tier, o.status, o.expires_at, om.role, om.override_tier
      into v_org_id, v_org_name, v_org_tier, v_org_status, v_org_expires, v_org_role, v_override_tier
      from organizations o
      join org_members om on om.org_id = o.id and om.user_id = p_user_id
      where o.id = v_personal_org_id
        and o.status = 'active'
        and om.status = 'active'
        and (o.expires_at is null or o.expires_at > now())
      limit 1;
  end if;

  -- 3. Pool assignment (highest priority for org users)
  if v_org_id is not null then
    select a.tier, p.expires_at
      into v_pool_tier, v_pool_expires
      from org_license_assignments a
      join org_license_pools p on p.id = a.pool_id and p.active = true
      where a.user_id     = p_user_id
        and a.org_id      = v_org_id
        and a.withdrawn_at is null
        and (p.expires_at is null or p.expires_at > now())
      limit 1;
  end if;

  -- 4. Priority chain: pool > org override > org > personal > free
  declare
    v_effective text;
    v_source    text;
    v_expires   timestamptz;
    v_status    text;
  begin
    if v_pool_tier is not null then
      v_effective := v_pool_tier;
      v_source    := 'pool_assignment';
      v_expires   := v_pool_expires;
    elsif v_override_tier is not null then
      v_effective := v_override_tier;
      v_source    := 'org_override';
      v_expires   := v_org_expires;
    elsif v_org_tier is not null
          and tier_rank(v_org_tier) > tier_rank(coalesce(v_personal_tier,'free')) then
      v_effective := v_org_tier;
      v_source    := 'org';
      v_expires   := v_org_expires;
    -- 🔴 v_personal_live added here. Everything else on this line is unchanged.
    elsif v_personal_tier is not null and v_personal_tier != 'free' and v_personal_live then
      v_effective := v_personal_tier;
      v_source    := 'personal';
      v_expires   := v_personal_expires;
    else
      v_effective := 'free';
      v_source    := 'default';
      v_expires   := null;
    end if;

    -- Say WHY someone is on free. Callers previously saw the stale personal
    -- status ('valid') next to an effective tier of 'free', which reads as a
    -- contradiction and gives the UI nothing true to show.
    if v_effective = 'free' and v_personal_tier is not null
       and v_personal_tier != 'free' and not v_personal_live then
      v_status := 'expired';
    else
      v_status := coalesce(v_org_status, v_personal_status, 'valid');
    end if;

    return query select
      v_effective, v_source, v_org_id, v_org_name, v_org_role,
      v_override_tier, v_expires,
      coalesce(v_personal_tokens, 0),
      v_status;
  end;
end;
$$;

revoke execute on function resolve_user_tier from public, anon, authenticated;
grant  execute on function resolve_user_tier to service_role;

-- ── Verify after applying ─────────────────────────────────────────────────────
-- Expect: every row below resolves to 'free' / 'default' / 'expired'.
--
--   select l.user_id, l.tier as stored, l.expires_at, r.effective_tier, r.tier_source, r.status
--     from licenses l
--     cross join lateral resolve_user_tier(l.user_id) r
--    where l.tier <> 'free' and l.expires_at < now();
--
-- And confirm nobody CURRENT was dropped — this must return zero rows:
--
--   select l.user_id, l.tier, l.expires_at, r.effective_tier
--     from licenses l
--     cross join lateral resolve_user_tier(l.user_id) r
--    where l.tier <> 'free'
--      and (l.expires_at is null or l.expires_at > now())
--      and r.effective_tier = 'free';
