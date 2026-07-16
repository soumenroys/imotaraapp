-- ============================================================
-- docs/sql/org_owner_race_lockdown.sql
--
-- /api/org/new does a count-then-insert (check for an existing org owned
-- by this user, then insert a new one) with no DB-level mutual exclusion —
-- two concurrent submissions from the same user could both pass the check
-- and both insert an org, giving one user two owned orgs (the app's own
-- rule, enforced only in application code until now, says one per user).
-- Same race class as admin_seed_race_lockdown.sql, same fix shape: a
-- partial unique index turns the second insert into a 23505 the route
-- can catch and turn into the existing "you already have an org" 409.
--
-- Run in Supabase SQL Editor after org_schema.sql.
-- ============================================================

create unique index if not exists organizations_single_owner
  on organizations (owner_user_id)
  where owner_user_id is not null;
