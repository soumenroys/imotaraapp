-- ============================================================
-- docs/sql/org_license_pools.sql
-- License Pool system: super-admin issues bulk license batches to orgs.
-- Org admins assign/withdraw/reassign from their pool.
--
-- Run in Supabase SQL Editor after org_schema.sql.
-- ============================================================

-- ── 1. ORG_LICENSE_POOLS ──────────────────────────────────────────────────────
-- One row per license batch issued by Imotara super-admin to an org.
-- An org can have multiple pools (e.g. 50 Pro + 100 Plus issued separately).

create table if not exists org_license_pools (
  id               uuid        primary key default gen_random_uuid(),
  org_id           uuid        not null references organizations(id) on delete cascade,

  -- The tier of licenses in this pool
  tier             text        not null,   -- 'free'|'plus'|'pro'|'edu'|'enterprise'

  -- Quantities
  quantity_total   integer     not null default 0,  -- total issued by super-admin
  quantity_used    integer     not null default 0,  -- currently active assignments

  -- Metadata
  label            text,                             -- e.g. "Annual Batch 2026"
  expires_at       timestamptz,                      -- when these licenses expire
  issued_by        text        not null default 'system',  -- super-admin name/email
  notes            text,

  active           boolean     not null default true,  -- super-admin can deactivate
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists org_license_pools_org_idx on org_license_pools (org_id, active);

alter table org_license_pools enable row level security;

-- Org admins can read their own pools
create policy "Org admins read own license pools"
  on org_license_pools for select
  using (
    exists (
      select 1 from org_members om
      where om.org_id  = org_license_pools.org_id
        and om.user_id = auth.uid()
        and om.role    in ('owner','admin')
        and om.status  = 'active'
    )
  );


-- ── 2. ORG_LICENSE_ASSIGNMENTS ────────────────────────────────────────────────
-- One row per assignment of a pool license to a specific user.
-- withdrawn_at = NULL means currently active assignment.
-- Soft delete on withdraw — history is preserved for audit.

create table if not exists org_license_assignments (
  id            uuid        primary key default gen_random_uuid(),
  pool_id       uuid        not null references org_license_pools(id) on delete cascade,
  org_id        uuid        not null references organizations(id) on delete cascade,
  user_id       uuid        not null references auth.users(id) on delete cascade,
  tier          text        not null,

  assigned_by   uuid        references auth.users(id) on delete set null,
  assigned_at   timestamptz not null default now(),

  -- Withdraw info (null = still active)
  withdrawn_at  timestamptz,
  withdrawn_by  uuid        references auth.users(id) on delete set null,
  withdraw_note text,

  -- withdrawn_at is null = active assignment
  withdrawn_note text -- alias kept for compat
);

-- Enforces only one active assignment per user per org (no btree_gist needed)
create unique index if not exists one_active_per_user_idx
  on org_license_assignments (org_id, user_id)
  where (withdrawn_at is null);

create index if not exists org_license_assignments_pool_idx on org_license_assignments (pool_id, withdrawn_at);
create index if not exists org_license_assignments_user_idx on org_license_assignments (user_id, withdrawn_at);
create index if not exists org_license_assignments_org_idx  on org_license_assignments (org_id, withdrawn_at);

alter table org_license_assignments enable row level security;

create policy "Org admins read own assignments"
  on org_license_assignments for select
  using (
    exists (
      select 1 from org_members om
      where om.org_id  = org_license_assignments.org_id
        and om.user_id = auth.uid()
        and om.role    in ('owner','admin')
        and om.status  = 'active'
    )
  );


-- ── 3. UPDATED resolve_user_tier() — includes pool assignments ────────────────
-- Priority: pool_assignment > org_member.override_tier > personal_license > org_tier > free

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
  v_pool_tier         text;
  v_pool_expires      timestamptz;
begin
  -- 1. Personal license
  select l.tier, l.status, l.expires_at, l.token_balance, l.org_id
    into v_personal_tier, v_personal_status, v_personal_expires, v_personal_tokens, v_personal_org_id
    from licenses l where l.user_id = p_user_id limit 1;

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

  -- 3. Check pool assignment (highest priority for org users)
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

  -- 4. Determine effective tier with priority chain
  declare
    v_effective text;
    v_source    text;
    v_expires   timestamptz;
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
    elsif v_personal_tier is not null and v_personal_tier != 'free' then
      v_effective := v_personal_tier;
      v_source    := 'personal';
      v_expires   := v_personal_expires;
    else
      v_effective := 'free';
      v_source    := 'default';
      v_expires   := null;
    end if;

    return query select
      v_effective, v_source, v_org_id, v_org_name, v_org_role,
      v_override_tier, v_expires,
      coalesce(v_personal_tokens, 0),
      coalesce(v_org_status, v_personal_status, 'valid');
  end;
end;
$$;

revoke execute on function resolve_user_tier from public, anon, authenticated;
grant  execute on function resolve_user_tier to service_role;


-- ── 4. ASSIGN_POOL_LICENSE() ──────────────────────────────────────────────────

create or replace function assign_pool_license(
  p_pool_id    uuid,
  p_user_id    uuid,
  p_assigned_by uuid  default null
)
returns uuid  -- returns new assignment id
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pool    org_license_pools%rowtype;
  v_asgn_id uuid;
begin
  select * into v_pool from org_license_pools where id = p_pool_id for update;

  if not found or not v_pool.active then
    raise exception 'License pool not found or inactive';
  end if;
  if v_pool.expires_at is not null and v_pool.expires_at < now() then
    raise exception 'License pool has expired';
  end if;
  if v_pool.quantity_used >= v_pool.quantity_total then
    raise exception 'No licenses available in this pool (% / %)', v_pool.quantity_used, v_pool.quantity_total;
  end if;

  -- Remove any existing active assignment for this user in this org (reassign flow)
  update org_license_assignments
    set withdrawn_at = now(), withdrawn_by = p_assigned_by, withdraw_note = 'superseded by reassignment'
    where org_id = v_pool.org_id and user_id = p_user_id and withdrawn_at is null;

  -- Decrement old pool if any active assignment existed
  update org_license_pools p
    set quantity_used = greatest(quantity_used - 1, 0)
    where p.id in (
      select a.pool_id from org_license_assignments a
      where a.org_id = v_pool.org_id and a.user_id = p_user_id
        and a.withdrawn_at = now()
      limit 1
    );

  -- Create new assignment
  insert into org_license_assignments (pool_id, org_id, user_id, tier, assigned_by)
    values (p_pool_id, v_pool.org_id, p_user_id, v_pool.tier, p_assigned_by)
    returning id into v_asgn_id;

  -- Increment pool counter
  update org_license_pools set quantity_used = quantity_used + 1 where id = p_pool_id;

  -- Sync licenses table so app shows correct tier immediately
  insert into licenses (user_id, tier, status, expires_at, org_id, source)
    values (p_user_id, v_pool.tier, 'valid', v_pool.expires_at, v_pool.org_id, 'pool')
    on conflict (user_id) do update
      set tier = v_pool.tier, expires_at = v_pool.expires_at, updated_at = now();

  -- Audit log
  insert into org_audit_log (org_id, actor_id, actor_role, action, target_user_id, changes)
    values (v_pool.org_id, p_assigned_by, 'org_admin', 'license_assigned', p_user_id,
            jsonb_build_object('tier', v_pool.tier, 'pool_id', p_pool_id));

  return v_asgn_id;
end;
$$;

revoke execute on function assign_pool_license from public, anon, authenticated;
grant  execute on function assign_pool_license to service_role;


-- ── 5. WITHDRAW_POOL_LICENSE() ────────────────────────────────────────────────

create or replace function withdraw_pool_license(
  p_assignment_id uuid,
  p_withdrawn_by  uuid  default null,
  p_note          text  default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_asgn  org_license_assignments%rowtype;
begin
  select * into v_asgn from org_license_assignments where id = p_assignment_id and withdrawn_at is null;
  if not found then raise exception 'Assignment not found or already withdrawn'; end if;

  update org_license_assignments
    set withdrawn_at = now(), withdrawn_by = p_withdrawn_by, withdraw_note = coalesce(p_note,'withdrawn by admin')
    where id = p_assignment_id;

  update org_license_pools set quantity_used = greatest(quantity_used - 1, 0)
    where id = v_asgn.pool_id;

  -- Reset license to org default
  update licenses set tier = (select tier from organizations where id = v_asgn.org_id),
                      updated_at = now()
    where user_id = v_asgn.user_id and org_id = v_asgn.org_id;

  insert into org_audit_log (org_id, actor_id, actor_role, action, target_user_id, changes)
    values (v_asgn.org_id, p_withdrawn_by, 'org_admin', 'license_withdrawn', v_asgn.user_id,
            jsonb_build_object('tier', v_asgn.tier, 'pool_id', v_asgn.pool_id, 'note', p_note));
end;
$$;

revoke execute on function withdraw_pool_license from public, anon, authenticated;
grant  execute on function withdraw_pool_license to service_role;
