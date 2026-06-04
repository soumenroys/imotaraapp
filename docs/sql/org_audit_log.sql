-- ============================================================
-- docs/sql/org_audit_log.sql
-- Phase 1A: Org-level audit log for all membership and config events
--
-- Run after org_schema.sql.
-- ============================================================

-- ── ORG_AUDIT_LOG ─────────────────────────────────────────────────────────────
-- Immutable audit trail of all org events.
-- Written by service-role API routes — never by client.
-- Org admins can read their own org's log (Phase 2D).
--
-- action values:
--   org_created       | org_approved     | org_suspended   | org_cancelled
--   member_invited    | member_joined    | member_removed  | member_suspended
--   role_changed      | seats_changed    | tier_changed    | expiry_changed
--   invite_expired    | invite_resent    | settings_changed

create table if not exists org_audit_log (
  id           uuid        primary key default gen_random_uuid(),
  org_id       uuid        not null references organizations(id) on delete cascade,

  -- Who performed the action
  -- actor_id NULL = system/automated action (e.g. invite expiry)
  actor_id     uuid        references auth.users(id) on delete set null,
  actor_email  text,       -- denormalised at time of action (actor may be deleted later)
  actor_role   text,       -- 'imotara_admin' | 'org_owner' | 'org_admin' | 'system'

  -- What happened
  action       text        not null,

  -- Who/what was affected (NULL for org-level actions)
  target_email text,
  target_user_id uuid      references auth.users(id) on delete set null,

  -- Before/after snapshot of changed values (flexible JSONB)
  -- e.g. { "tier": { "from": "edu", "to": "enterprise" } }
  --      { "role": { "from": "member", "to": "admin" } }
  --      { "seats_purchased": { "from": 100, "to": 200 } }
  changes      jsonb       not null default '{}'::jsonb,

  -- Free-text note (admin reason, context)
  notes        text,

  created_at   timestamptz not null default now()
);

-- Fast per-org log queries (org admin dashboard)
create index if not exists org_audit_log_org_idx
  on org_audit_log (org_id, created_at desc);

-- Target user lookup
create index if not exists org_audit_log_target_idx
  on org_audit_log (target_user_id, created_at desc);

-- Actor lookup
create index if not exists org_audit_log_actor_idx
  on org_audit_log (actor_id, created_at desc);

-- RLS
alter table org_audit_log enable row level security;

-- Org admins and owners can read their own org's audit log
create policy "Org admins read own audit log"
  on org_audit_log for select
  using (
    exists (
      select 1 from org_members om
      where om.org_id = org_audit_log.org_id
        and om.user_id = auth.uid()
        and om.role in ('owner', 'admin')
        and om.status = 'active'
    )
  );

-- Imotara super-admin reads all (via service-role — no RLS needed for service_role)
-- No client-side writes
