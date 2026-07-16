-- ============================================================
-- docs/sql/fix_pool_release_on_member_removal.sql
--
-- revoke_org_license() (called by every member-removal path, including the
-- app-side releasePriorOrgMembership() helper) never released a pool-
-- assigned license — org_license_assignments kept the row "active"
-- (withdrawn_at stays null) and org_license_pools.quantity_used was never
-- decremented. A pool-assigned seat stayed permanently occupied after the
-- person left the org, with no admin-visible signal that capacity had
-- silently leaked (the person doesn't even show on the Members tab anymore).
--
-- This re-defines revoke_org_license() to also withdraw any active pool
-- assignment for that (user, org) pair, inline — same effect as calling
-- withdraw_pool_license() for it, just folded into the single removal
-- transaction instead of requiring a second manual admin action.
--
-- Run in Supabase SQL Editor after org_license_pools.sql.
-- ============================================================

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
  v_asgn        org_license_assignments%rowtype;
begin
  select email into v_user_email from auth.users where id = p_user_id;
  select name  into v_org_name   from organizations where id = p_org_id;

  -- Release any active pool-assigned license for this (user, org) pair first,
  -- so quantity_used is always accurate the moment membership ends — no
  -- separate admin action required, and no permanently-leaked pool capacity.
  select * into v_asgn
    from org_license_assignments
    where user_id = p_user_id and org_id = p_org_id and withdrawn_at is null
    limit 1;

  if found then
    update org_license_assignments
      set withdrawn_at = now(), withdrawn_by = p_actor_id, withdraw_note = coalesce(p_reason, 'member removed from org')
      where id = v_asgn.id;

    update org_license_pools set quantity_used = greatest(quantity_used - 1, 0)
      where id = v_asgn.pool_id;
  end if;

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
      jsonb_build_object('org_name', v_org_name, 'pool_assignment_released', found)
    );
end;
$$;

revoke execute on function revoke_org_license from public, anon, authenticated;
grant  execute on function revoke_org_license to service_role;
