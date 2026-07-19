-- ============================================================
-- docs/sql/org_seat_leak_idempotency_fix.sql
-- Fixes a real seat-count leak: assign_org_license() unconditionally did
-- seats_used = seats_used + 1 on every call, with no check for whether the
-- user already holds a seat in this org. Repeated/rapid calls for the same
-- user (retry, double-click, or a re-invite race) each incremented the
-- counter independently, so seats_used could drift upward indefinitely
-- while the actual member count stayed correct. Surfaced during testing of
-- the new admin-provisioning "create_and_invite" flow, but the underlying
-- function is shared by the pre-existing "add existing member" path too —
-- this was always a latent risk there as well, just never triggered by
-- normal (non-repeated) usage.
--
-- Fix: only increment seats_used when this user's licenses row does NOT
-- already point at this org (i.e. a genuinely new assignment). A repeat
-- call for someone who already holds this org's seat becomes a safe no-op
-- on the counter (the license upsert below it still runs harmlessly).
-- revoke_org_license() already clears licenses.org_id on removal, so a
-- legitimate re-assignment after a real removal still increments correctly.
--
-- Run this in the Supabase SQL Editor. Safe to re-run (uses `create or
-- replace function`).
-- ============================================================

create or replace function assign_org_license(
  p_user_id    uuid,
  p_org_id     uuid,
  p_actor_id   uuid    default null,
  p_actor_role text    default 'system'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org               organizations%rowtype;
  v_user_email        text;
  v_already_has_seat  boolean;
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

  -- Idempotency check: does this user already hold a seat in THIS org?
  -- (licenses.org_id is cleared to null by revoke_org_license on removal,
  -- so this is false again after a genuine removal, and a re-assignment
  -- correctly increments below.)
  select exists(
    select 1 from licenses where user_id = p_user_id and org_id = p_org_id
  ) into v_already_has_seat;

  if not v_already_has_seat and v_org.seats_used >= v_org.seats_purchased then
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

  -- Increment seats used — only for a genuinely new assignment
  if not v_already_has_seat then
    update organizations
      set seats_used = seats_used + 1,
          updated_at = now()
      where id = p_org_id;
  end if;

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
      jsonb_build_object('tier', v_org.tier, 'org_name', v_org.name, 'seat_already_held', v_already_has_seat)
    );
end;
$$;

revoke execute on function assign_org_license from public, anon, authenticated;
grant  execute on function assign_org_license to service_role;

-- ── One-time data correction ──────────────────────────────────────────────
-- Recompute seats_used from the actual number of active members, for every
-- org where the counter has drifted (safe to run regardless of whether
-- drift exists — it's idempotent, just recomputes truth from source data).
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
