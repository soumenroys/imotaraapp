-- docs/sql/connect_org_scoping_step1.sql
--
-- CONNECT ORG SCOPING — STEP 1 of 6: columns, defaults, backfill, helper.
-- Created 2026-10-06. Serves P0-E (committed to SHEOWS for 15 Nov 2026).
--
-- 🔴 WHY THIS EXISTS
-- Connect has NO notion of which organisation a consultant or a session belongs
-- to: 0 of 28 Connect API routes reference org_id. For an NGO deployment the
-- failure mode is one organisation's members seeing another's people, sessions
-- or notes. On a mental-health product that is the worst defect available, so
-- the scoping foundation goes in BEFORE any org-only content can exist.
--
-- ✅ THIS MIGRATION IS BEHAVIOUR-NEUTRAL BY CONSTRUCTION.
-- Every existing consultant backfills to visibility='public', org_id=null, and
-- every existing session to org_id=null. Nothing is filtered differently until
-- step 2 adds the read predicate, and even then 'public' matches everything
-- that exists today. It is safe to run before the 12 Oct go-live.
--
-- Live data at time of writing: 8 consultants (3 approved, 5 deleted),
-- 27 sessions, 33 messages. The backfill is trivial now and will not stay that
-- way — which is the argument for doing it now rather than later.
--
-- ⛔ WHAT THIS DELIBERATELY DOES NOT TOUCH
--   connect_wallet / connect_recharges / connect_payouts — personal money. A
--     consultant's earnings are theirs, not their organisation's. Scoping money
--     by org would be both wrong and a payout bug waiting to happen.
--   connect_messages / connect_session_notes — scope is DERIVED from the
--     session. A second copy of the scope column would drift from the first.
--   connect_favorites / connect_blocks — personal preference, derived at read
--     time from consultant visibility.
--
-- ROLLBACK is at the bottom.

begin;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. connect_consultants — the root of "who may be seen and booked"
-- ─────────────────────────────────────────────────────────────────────────────

alter table connect_consultants
  add column if not exists org_id uuid
    references organizations(id) on delete set null;

-- visibility: 'public' = the open marketplace (today's behaviour, hence the
-- default). 'org_only' = visible solely to members of org_id.
alter table connect_consultants
  add column if not exists visibility text not null default 'public';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'connect_consultants_visibility_chk'
  ) then
    alter table connect_consultants
      add constraint connect_consultants_visibility_chk
      check (visibility in ('public', 'org_only'));
  end if;
end $$;

-- An org_only consultant without an org is unreachable by anyone — a silent
-- dead row. Forbid it rather than let it be created and wondered about later.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'connect_consultants_org_only_needs_org_chk'
  ) then
    alter table connect_consultants
      add constraint connect_consultants_org_only_needs_org_chk
      check (visibility <> 'org_only' or org_id is not null);
  end if;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. connect_sessions — stamped at creation, never derived
-- ─────────────────────────────────────────────────────────────────────────────
-- ⚠️ This is a HISTORICAL FACT, not a join. A member can leave their
-- organisation later; billing, reporting and audit must continue to say which
-- org the session belonged to AT THE TIME. Deriving it from the member's
-- current org would silently rewrite history.
--
-- Trade-off, chosen consciously: on org deletion this becomes null (the FK
-- below), so the historical link is lost rather than left dangling. If billing
-- ever needs to survive org deletion, add org_name_at_time text — do NOT drop
-- the FK and keep an orphan uuid.

alter table connect_sessions
  add column if not exists org_id uuid
    references organizations(id) on delete set null;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Indexes for the predicates step 2 will add
-- ─────────────────────────────────────────────────────────────────────────────

create index if not exists connect_consultants_org_id_idx
  on connect_consultants (org_id);

-- The marketplace listing reads "public and approved" on every browse.
-- Partial index: visibility is constant inside the predicate, so it is not a
-- key column — status is what the query actually narrows on.
create index if not exists connect_consultants_public_approved_idx
  on connect_consultants (status)
  where visibility = 'public';

create index if not exists connect_sessions_org_id_idx
  on connect_sessions (org_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. The per-org marketplace switch — ONE place, not scattered
-- ─────────────────────────────────────────────────────────────────────────────
-- Owner decision 2026-10-06: members MAY book public marketplace companions,
-- "but admin can set that option from his login". So it is a per-org setting,
-- not a global rule. organizations.org_settings (jsonb) already exists, so this
-- needs no DDL — only a single reader so the default lives in one place.
--
-- 🔑 Default TRUE: an org that has never touched the setting behaves exactly as
-- it does today.

create or replace function org_allows_public_connect(p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select (org_settings ->> 'connect_allow_public')::boolean
       from organizations where id = p_org_id),
    true
  );
$$;

revoke execute on function org_allows_public_connect(uuid) from public, anon;
grant  execute on function org_allows_public_connect(uuid) to authenticated, service_role;

comment on function org_allows_public_connect(uuid) is
  'Per-org switch for the public Connect marketplace. Defaults to true when the org has not set it, so existing orgs are unaffected. An org''s OWN consultants stay visible to its members regardless of this setting — switching it off must never leave a member with nobody to talk to.';

commit;


-- ─────────────────────────────────────────────────────────────────────────────
-- VERIFY (run after; all three should return the stated result)
-- ─────────────────────────────────────────────────────────────────────────────
-- Every existing consultant is public and unaffiliated  → expect 0 rows:
--   select id, display_name, org_id, visibility from connect_consultants
--    where visibility <> 'public' or org_id is not null;
--
-- Every existing session is unaffiliated                → expect 0 rows:
--   select id from connect_sessions where org_id is not null;
--
-- The default reader works for an org that never set it → expect true:
--   select org_allows_public_connect(
--     (select id from organizations order by created_at limit 1));


-- ─────────────────────────────────────────────────────────────────────────────
-- ROLLBACK (safe: nothing reads these columns until step 2)
-- ─────────────────────────────────────────────────────────────────────────────
-- begin;
--   drop function if exists org_allows_public_connect(uuid);
--   drop index if exists connect_sessions_org_id_idx;
--   drop index if exists connect_consultants_public_approved_idx;
--   drop index if exists connect_consultants_org_id_idx;
--   alter table connect_sessions     drop column if exists org_id;
--   alter table connect_consultants  drop constraint if exists connect_consultants_org_only_needs_org_chk;
--   alter table connect_consultants  drop constraint if exists connect_consultants_visibility_chk;
--   alter table connect_consultants  drop column if exists visibility;
--   alter table connect_consultants  drop column if exists org_id;
-- commit;
