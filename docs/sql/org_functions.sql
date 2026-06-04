-- ============================================================
-- docs/sql/org_functions.sql
-- Phase 1A + 1B: All DB functions for org licensing
--
-- Run last, after org_schema.sql, org_audit_log.sql, org_licenses_alter.sql.
-- All functions use security definer + service_role restriction.
-- ============================================================


-- ── 1. RESOLVE USER TIER ──────────────────────────────────────────────────────
-- Returns the effective tier for a user.
-- Rule: personal license tier takes priority over org license if it is higher.
-- Used by /api/license/status to return the correct tier to the client.

create or replace function resolve_user_tier(p_user_id uuid)
returns table (
  effective_tier    text,
  tier_source       text,    -- 'personal' | 'org' | 'default'
  org_id            uuid,
  org_name          text,
  org_role          text,    -- owner | admin | member | NULL
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
begin
  -- 1. Read personal license row
  select l.tier, l.status, l.expires_at, l.token_balance, l.org_id
    into v_personal_tier, v_personal_status, v_personal_expires, v_personal_tokens, v_personal_org_id
    from licenses l
    where l.user_id = p_user_id
    limit 1;

  -- 2. If user has an org_id on their license, read the org details
  if v_personal_org_id is not null then
    select o.id, o.name, o.tier, o.status, o.expires_at, om.role
      into v_org_id, v_org_name, v_org_tier, v_org_status, v_org_expires, v_org_role
      from organizations o
      join org_members om on om.org_id = o.id and om.user_id = p_user_id
      where o.id = v_personal_org_id
        and o.status = 'active'
        and om.status = 'active'
        and (o.expires_at is null or o.expires_at > now())
      limit 1;
  end if;

  -- 3. Determine effective tier: higher of personal vs org
  if v_org_tier is not null
     and tier_rank(v_org_tier) > tier_rank(coalesce(v_personal_tier, 'free'))
  then
    -- Org tier wins
    return query select
      v_org_tier,
      'org'::text,
      v_org_id,
      v_org_name,
      v_org_role,
      v_org_expires,
      coalesce(v_personal_tokens, 0),
      coalesce(v_org_status, 'valid');
  elsif v_personal_tier is not null and v_personal_tier != 'free' then
    -- Personal license wins
    return query select
      v_personal_tier,
      'personal'::text,
      v_org_id,
      v_org_name,
      v_org_role,
      v_personal_expires,
      coalesce(v_personal_tokens, 0),
      coalesce(v_personal_status, 'valid');
  else
    -- Default: free
    return query select
      'free'::text,
      'default'::text,
      v_org_id,
      v_org_name,
      v_org_role,
      null::timestamptz,
      coalesce(v_personal_tokens, 0),
      'valid'::text;
  end if;
end;
$$;

revoke execute on function resolve_user_tier from public, anon, authenticated;
grant  execute on function resolve_user_tier to service_role;


-- ── 2. ASSIGN ORG LICENSE ─────────────────────────────────────────────────────
-- Called when a user accepts an org invite.
-- Upserts their license row with org tier + org_id.
-- Enforces seat limit — raises exception if org is full.
-- Logs to org_audit_log.

create or replace function assign_org_license(
  p_user_id    uuid,
  p_org_id     uuid,
  p_actor_id   uuid    default null,   -- who performed the action
  p_actor_role text    default 'system'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org         organizations%rowtype;
  v_user_email  text;
begin
  -- Lock the org row to prevent race conditions on seats_used
  select * into v_org from organizations where id = p_org_id for update;

  if not found then
    raise exception 'Organization not found: %', p_org_id;
  end if;

  if v_org.status != 'active' then
    raise exception 'Organization is not active: %', v_org.status;
  end if;

  if v_org.expires_at is not null and v_org.expires_at < now() then
    raise exception 'Organization license has expired';
  end if;

  if v_org.seats_used >= v_org.seats_purchased then
    raise exception 'Organization has no available seats (% / %)',
      v_org.seats_used, v_org.seats_purchased;
  end if;

  -- Get user email for audit log
  select email into v_user_email from auth.users where id = p_user_id;

  -- Upsert license row: set org tier and link org_id
  insert into licenses (user_id, tier, status, expires_at, org_id, source)
    values (p_user_id, v_org.tier, 'valid', v_org.expires_at, p_org_id, 'org')
    on conflict (user_id) do update
      set org_id     = p_org_id,
          -- Only upgrade tier via org, never downgrade a personal license
          tier       = case
            when tier_rank(v_org.tier) > tier_rank(licenses.tier) then v_org.tier
            else licenses.tier
          end,
          expires_at = case
            when tier_rank(v_org.tier) > tier_rank(licenses.tier) then v_org.expires_at
            else licenses.expires_at
          end,
          updated_at = now();

  -- Increment seats used
  update organizations
    set seats_used = seats_used + 1,
        updated_at = now()
    where id = p_org_id;

  -- Audit log entry
  insert into org_audit_log (org_id, actor_id, actor_email, actor_role, action, target_user_id, target_email, changes)
    values (
      p_org_id,
      p_actor_id,
      (select email from auth.users where id = p_actor_id),
      p_actor_role,
      'member_joined',
      p_user_id,
      v_user_email,
      jsonb_build_object('tier', v_org.tier, 'org_name', v_org.name)
    );
end;
$$;

revoke execute on function assign_org_license from public, anon, authenticated;
grant  execute on function assign_org_license to service_role;


-- ── 3. REVOKE ORG LICENSE ─────────────────────────────────────────────────────
-- Called when a member is removed from an org.
-- Resets license to free (or retains personal tier if they have one).
-- Decrements org seats_used.

create or replace function revoke_org_license(
  p_user_id    uuid,
  p_org_id     uuid,
  p_actor_id   uuid    default null,
  p_actor_role text    default 'system',
  p_reason     text    default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_email  text;
  v_org_name    text;
begin
  select email into v_user_email from auth.users where id = p_user_id;
  select name  into v_org_name   from organizations where id = p_org_id;

  -- Reset license: clear org_id and drop back to free
  -- (If user had a higher personal tier before joining, that was preserved in the tier column;
  --  we reset to free since we can't know what their pre-org personal tier was without history.
  --  A cleaner solution is tracked in Phase 3 — storing pre-org tier in org_members.)
  update licenses
    set org_id     = null,
        tier       = 'free',
        status     = 'valid',
        expires_at = null,
        source     = 'manual',
        updated_at = now()
    where user_id = p_user_id
      and org_id  = p_org_id;

  -- Decrement seats (guard against going below 0)
  update organizations
    set seats_used = greatest(seats_used - 1, 0),
        updated_at = now()
    where id = p_org_id;

  -- Mark org_member as removed
  update org_members
    set status = 'removed'
    where org_id = p_org_id and user_id = p_user_id;

  -- Audit log
  insert into org_audit_log (org_id, actor_id, actor_email, actor_role, action, target_user_id, target_email, notes, changes)
    values (
      p_org_id,
      p_actor_id,
      (select email from auth.users where id = p_actor_id),
      p_actor_role,
      'member_removed',
      p_user_id,
      v_user_email,
      p_reason,
      jsonb_build_object('org_name', v_org_name)
    );
end;
$$;

revoke execute on function revoke_org_license from public, anon, authenticated;
grant  execute on function revoke_org_license to service_role;


-- ── 4. GET ORG MEMBERS ────────────────────────────────────────────────────────
-- Returns all active members of an org with their auth info.
-- Used by the org admin dashboard members tab.

create or replace function get_org_members(
  p_org_id     uuid,
  p_page       integer default 0,
  p_limit      integer default 50
)
returns table (
  user_id      uuid,
  email        text,
  role         text,
  status       text,
  joined_at    timestamptz,
  last_sign_in timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    om.user_id,
    u.email,
    om.role,
    om.status,
    om.joined_at,
    u.last_sign_in_at
  from org_members om
  join auth.users u on u.id = om.user_id
  where om.org_id = p_org_id
    and om.status = 'active'
  order by om.joined_at desc
  offset p_page * p_limit
  limit p_limit;
$$;

revoke execute on function get_org_members from public, anon, authenticated;
grant  execute on function get_org_members to service_role;


-- ── 5. GET ORG USAGE STATS ────────────────────────────────────────────────────
-- Aggregate (anonymized) usage stats for an org.
-- Used by org admin dashboard analytics tab (EDU/NGO billing_type).
-- NEVER returns individual user data.

create or replace function get_org_usage_stats(
  p_org_id      uuid,
  p_days_back   integer default 30
)
returns table (
  stat_date         date,
  active_users      bigint,   -- users who had at least 1 event on that date
  total_events      bigint,   -- total chat_reply events
  avg_session_mins  numeric   -- rough proxy: events per active user × 3 min average
)
language sql
security definer
set search_path = public
as $$
  select
    date_trunc('day', ue.created_at)::date             as stat_date,
    count(distinct ue.user_id)                          as active_users,
    count(ue.id)                                        as total_events,
    round(count(ue.id)::numeric / nullif(count(distinct ue.user_id), 0) * 3, 1)
                                                        as avg_session_mins
  from usage_events ue
  join org_members om on om.user_id = ue.user_id
    and om.org_id = p_org_id
    and om.status = 'active'
  where ue.created_at >= now() - (p_days_back || ' days')::interval
  group by date_trunc('day', ue.created_at)::date
  order by stat_date desc;
$$;

revoke execute on function get_org_usage_stats from public, anon, authenticated;
grant  execute on function get_org_usage_stats to service_role;


-- ── 6. ADMIN SEARCH ORGS ─────────────────────────────────────────────────────
-- Used by Imotara super-admin /admin Organizations tab.
-- Searches by org name, slug, or owner email.

create or replace function admin_search_orgs(
  search_query  text    default null,
  status_filter text    default null,   -- null = all
  page_offset   integer default 0,
  page_limit    integer default 20
)
returns table (
  org_id           uuid,
  name             text,
  slug             text,
  billing_type     text,
  tier             text,
  status           text,
  seats_purchased  integer,
  seats_used       integer,
  owner_email      text,
  expires_at       timestamptz,
  created_at       timestamptz,
  member_count     bigint
)
language sql
security definer
set search_path = public
as $$
  select
    o.id              as org_id,
    o.name,
    o.slug,
    o.billing_type,
    o.tier,
    o.status,
    o.seats_purchased,
    o.seats_used,
    u.email           as owner_email,
    o.expires_at,
    o.created_at,
    count(om.id)      as member_count
  from organizations o
  left join auth.users u  on u.id = o.owner_user_id
  left join org_members om on om.org_id = o.id and om.status = 'active'
  where
    (status_filter is null or o.status = status_filter)
    and (
      search_query is null
      or o.name  ilike '%' || search_query || '%'
      or o.slug  ilike '%' || search_query || '%'
      or u.email ilike '%' || search_query || '%'
    )
  group by o.id, u.email
  order by o.created_at desc
  offset page_offset
  limit page_limit;
$$;

revoke execute on function admin_search_orgs from public, anon, authenticated;
grant  execute on function admin_search_orgs to service_role;


-- ── 7. CHECK ORG SEAT AVAILABILITY ────────────────────────────────────────────
-- Quick check before sending an invite — returns false if org is full.

create or replace function check_org_seat_available(p_org_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select seats_used < seats_purchased
    and  status = 'active'
    and  (expires_at is null or expires_at > now())
  from organizations
  where id = p_org_id;
$$;

revoke execute on function check_org_seat_available from public, anon, authenticated;
grant  execute on function check_org_seat_available to service_role;
