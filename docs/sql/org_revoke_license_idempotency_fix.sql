-- ============================================================
-- docs/sql/org_revoke_license_idempotency_fix.sql
--
-- Mirror of org_seat_leak_idempotency_fix.sql, but for the REVOKE side.
-- That earlier fix made assign_org_license() safe to call twice for the
-- same (user, org) pair — a repeat call became a no-op on seats_used
-- instead of double-incrementing. revoke_org_license() was never given
-- the matching guard: a repeat call (double-click on "Withdraw", a retry
-- after a slow response, or any other duplicate call) unconditionally
-- decrements seats_used again, even though the member was already removed
-- and their seat already released.
--
-- Found 2026-07-19 while backend-verifying the licenses-page Withdraw fix:
-- calling DELETE /api/org/dashboard/members?userId=X twice in a row on the
-- same member took a 2-seat org from seats_used=2 -> 1 (correct, one real
-- member left) -> 0 (WRONG — the second call had nothing left to revoke,
-- but decremented anyway). A third call correctly floors at 0 via the
-- existing greatest(seats_used - 1, 0) guard, but by then the count is
-- already wrong for however many real seats remain.
--
-- Fix: only actually release the pool assignment, reset the license,
-- decrement seats_used, and mark the member removed if this member is
-- CURRENTLY active. A repeat call for someone already removed (or never a
-- member) becomes a safe no-op — matching the philosophy of the assign-side
-- fix exactly.
--
-- Run this in the Supabase SQL Editor. Safe to re-run (uses `create or
-- replace function`).
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
  v_was_active  boolean;
begin
  select email into v_user_email from auth.users where id = p_user_id;
  select name  into v_org_name   from organizations where id = p_org_id;

  -- Idempotency guard: only proceed if this member is currently active.
  -- A repeat call for someone already removed (or never a member here)
  -- becomes a safe no-op instead of double-releasing a pool seat or
  -- double-decrementing seats_used.
  select exists(
    select 1 from org_members
    where org_id = p_org_id and user_id = p_user_id and status = 'active'
  ) into v_was_active;

  if not v_was_active then
    return;
  end if;

  -- Release any active pool-assigned license for this (user, org) pair first,
  -- so quantity_used is always accurate the moment membership ends.
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

  -- Reset license: clear org_id and drop back to free.
  update licenses
    set org_id     = null,
        tier       = 'free',
        status     = 'valid',
        expires_at = null,
        source     = 'manual',
        updated_at = now()
    where user_id = p_user_id
      and org_id  = p_org_id;

  -- Decrement seats — guarded above by v_was_active, so this only ever
  -- happens once per genuine removal.
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

-- ── One-time data correction ──────────────────────────────────────────────
-- Recompute seats_used from the actual number of active members, for every
-- org where the counter has drifted (same recomputation the assign-side fix
-- already did once — safe to re-run, catches any drift from this bug too).
update organizations o
set seats_used = coalesce((
  select count(*) from org_members m
  where m.org_id = o.id and m.status = 'active'
), 0),
    updated_at = now()
where o.seats_used != coalesce((
  select count(*) from org_members m
  where m.org_id = o.id and m.status = 'active'
), 0);
