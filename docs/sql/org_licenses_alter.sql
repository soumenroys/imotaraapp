-- ============================================================
-- docs/sql/org_licenses_alter.sql
-- Phase 1A: Extend licenses table to support org membership
--
-- Run after org_schema.sql and org_audit_log.sql.
-- Safe to run on existing production licenses table (all new columns are nullable).
-- ============================================================

-- Add org_id to licenses — NULL means personal license (existing behaviour)
-- When set, the user is on an org plan; tier/status/expires_at reflect the org's license.
alter table licenses
  add column if not exists org_id uuid references organizations(id) on delete set null;

-- Index for org-wide license queries (e.g. count seats, bulk revoke on org cancellation)
create index if not exists licenses_org_idx
  on licenses (org_id)
  where org_id is not null;

-- ── Tier ordering helper ───────────────────────────────────────────────────────
-- Used by resolve_user_tier() to pick the higher of personal vs org tier.
-- free(0) < plus(1) < pro(2) < family(3) < edu(4) < enterprise(5)

create or replace function tier_rank(t text)
returns integer
language sql
immutable
parallel safe
as $$
  select case t
    when 'free'       then 0
    when 'plus'       then 1
    when 'pro'        then 2
    when 'family'     then 3
    when 'edu'        then 4
    when 'enterprise' then 5
    else 0
  end;
$$;
