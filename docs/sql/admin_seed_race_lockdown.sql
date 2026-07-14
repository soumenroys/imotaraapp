-- admin_seed_race_lockdown.sql
-- POST /api/admin/auth/seed does a count-then-insert with no DB-level mutual
-- exclusion: two concurrent requests hitting the route in the narrow window
-- before any admin exists could both read count=0 and both insert an owner.
-- This partial unique index makes the second insert fail with 23505 instead,
-- which the route now catches and turns into the existing 409 response.
alter table super_admins add column if not exists is_seed_owner boolean not null default false;

create unique index if not exists super_admins_single_seed_owner
  on super_admins ((is_seed_owner))
  where is_seed_owner = true;
