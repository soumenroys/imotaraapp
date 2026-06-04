-- ============================================================
-- docs/sql/org_license_management.sql
-- Per-member license tier override + engagement stats
--
-- Run in Supabase SQL Editor.
-- ============================================================

-- ── 1. PER-MEMBER LICENSE TIER OVERRIDE ──────────────────────────────────────
-- Org admins can assign a specific license tier to individual members,
-- overriding the org-wide default tier.
-- NULL = use org default tier (existing behaviour).
-- Values: 'free' | 'plus' | 'pro' | 'family' | 'edu' | 'enterprise'

alter table org_members
  add column if not exists override_tier text;  -- NULL = inherit org tier

-- ── 2. UPDATED resolve_user_tier() — includes per-member override ─────────────
-- Tier priority: override_tier > personal_license > org_tier > 'free'

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
  v_org_tier          text;
  v_org_status        text;
  v_org_expires       timestamptz;
  v_org_name          text;
  v_org_id            uuid;
  v_org_role          text;
  v_override_tier     text;
begin
  -- 1. Read personal license row
  select l.tier, l.status, l.expires_at, l.token_balance, l.org_id
    into v_personal_tier, v_personal_status, v_personal_expires, v_personal_tokens, v_personal_org_id
    from licenses l where l.user_id = p_user_id limit 1;

  -- 2. If user has org_id, read org + per-member override
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

  -- 3. Determine effective tier:
  --    priority: per-member override > personal license > org default > free
  declare
    v_effective text;
    v_source    text;
  begin
    if v_override_tier is not null then
      v_effective := v_override_tier;
      v_source    := 'org_override';
    elsif v_org_tier is not null
          and tier_rank(v_org_tier) > tier_rank(coalesce(v_personal_tier,'free')) then
      v_effective := v_org_tier;
      v_source    := 'org';
    elsif v_personal_tier is not null and v_personal_tier != 'free' then
      v_effective := v_personal_tier;
      v_source    := 'personal';
    else
      v_effective := 'free';
      v_source    := 'default';
    end if;

    return query select
      v_effective,
      v_source,
      v_org_id,
      v_org_name,
      v_org_role,
      v_override_tier,
      case when v_source = 'org' or v_source = 'org_override' then v_org_expires
           else v_personal_expires end,
      coalesce(v_personal_tokens, 0),
      coalesce(case when v_source = 'org' or v_source = 'org_override'
                    then v_org_status else v_personal_status end, 'valid');
  end;
end;
$$;

revoke execute on function resolve_user_tier from public, anon, authenticated;
grant  execute on function resolve_user_tier to service_role;


-- ── 3. GET_ORG_MEMBER_STATS — engagement stats per member (privacy-safe) ──────
-- Returns session count and last active date — NO emotional content, ever.

create or replace function get_org_member_stats(
  p_org_id    uuid,
  p_days_back integer default 30
)
returns table (
  user_id        uuid,
  sessions_count bigint,     -- number of chat sessions in last N days
  last_active    timestamptz -- most recent usage event
)
language sql
security definer
set search_path = public
as $$
  select
    ue.user_id,
    count(distinct date_trunc('day', ue.created_at)) as sessions_count,
    max(ue.created_at)                               as last_active
  from usage_events ue
  join org_members om on om.user_id = ue.user_id
    and om.org_id = p_org_id
    and om.status = 'active'
  where ue.created_at >= now() - (p_days_back || ' days')::interval
  group by ue.user_id;
$$;

revoke execute on function get_org_member_stats from public, anon, authenticated;
grant  execute on function get_org_member_stats to service_role;


-- ── 4. GET_ORG_LICENSE_INVENTORY — license breakdown for org dashboard ─────────
-- Returns count of members per effective tier + seats summary.

create or replace function get_org_license_inventory(p_org_id uuid)
returns table (
  org_tier           text,
  seats_purchased    integer,
  seats_used         integer,
  tier_breakdown     jsonb    -- { "enterprise": 5, "pro": 3, "plus": 2, ... }
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org       organizations%rowtype;
  v_breakdown jsonb := '{}'::jsonb;
  v_row       record;
begin
  select * into v_org from organizations where id = p_org_id;

  -- Count members by their override_tier (or org default if null)
  for v_row in
    select coalesce(om.override_tier, v_org.tier) as effective_tier, count(*) as cnt
    from org_members om
    where om.org_id = p_org_id and om.status = 'active'
    group by coalesce(om.override_tier, v_org.tier)
  loop
    v_breakdown := v_breakdown || jsonb_build_object(v_row.effective_tier, v_row.cnt);
  end loop;

  return query select
    v_org.tier,
    v_org.seats_purchased,
    v_org.seats_used,
    v_breakdown;
end;
$$;

revoke execute on function get_org_license_inventory from public, anon, authenticated;
grant  execute on function get_org_license_inventory to service_role;
