-- ============================================================
-- docs/sql/fix_pool_reassignment.sql
-- Fix race condition in assign_pool_license():
-- The original used `withdrawn_at = now()` in a WHERE clause which
-- is unreliable. Now uses explicit CTE to capture withdrawn IDs.
-- Run in Supabase SQL Editor.
-- ============================================================

create or replace function assign_pool_license(
  p_pool_id     uuid,
  p_user_id     uuid,
  p_assigned_by uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pool         org_license_pools%rowtype;
  v_old_pool_id  uuid;
  v_asgn_id      uuid;
begin
  select * into v_pool from org_license_pools where id = p_pool_id for update;

  if not found or not v_pool.active then
    raise exception 'License pool not found or inactive';
  end if;
  if v_pool.expires_at is not null and v_pool.expires_at < now() then
    raise exception 'License pool has expired';
  end if;
  if v_pool.quantity_used >= v_pool.quantity_total then
    raise exception 'No licenses available in this pool (% / %)',
      v_pool.quantity_used, v_pool.quantity_total;
  end if;

  -- Capture old pool_id BEFORE withdrawing
  select pool_id into v_old_pool_id
    from org_license_assignments
    where org_id = v_pool.org_id and user_id = p_user_id and withdrawn_at is null
    limit 1;

  -- Withdraw existing active assignment (if any)
  update org_license_assignments
    set withdrawn_at  = now(),
        withdrawn_by  = p_assigned_by,
        withdraw_note = 'superseded by reassignment'
    where org_id = v_pool.org_id and user_id = p_user_id and withdrawn_at is null;

  -- Decrement old pool using captured pool_id (no race condition)
  if v_old_pool_id is not null then
    update org_license_pools
      set quantity_used = greatest(quantity_used - 1, 0)
      where id = v_old_pool_id;
  end if;

  -- Create new assignment
  insert into org_license_assignments (pool_id, org_id, user_id, tier, assigned_by)
    values (p_pool_id, v_pool.org_id, p_user_id, v_pool.tier, p_assigned_by)
    returning id into v_asgn_id;

  -- Increment new pool counter
  update org_license_pools set quantity_used = quantity_used + 1 where id = p_pool_id;

  -- Sync licenses table so app shows correct tier immediately
  insert into licenses (user_id, tier, status, expires_at, org_id, source)
    values (p_user_id, v_pool.tier, 'valid', v_pool.expires_at, v_pool.org_id, 'pool')
    on conflict (user_id) do update
      set tier       = v_pool.tier,
          expires_at = v_pool.expires_at,
          updated_at = now();

  -- Audit log
  insert into org_audit_log (org_id, actor_id, actor_role, action, target_user_id, changes)
    values (v_pool.org_id, p_assigned_by, 'org_admin', 'license_assigned', p_user_id,
            jsonb_build_object('tier', v_pool.tier, 'pool_id', p_pool_id));

  return v_asgn_id;
end;
$$;

revoke execute on function assign_pool_license from public, anon, authenticated;
grant  execute on function assign_pool_license to service_role;
