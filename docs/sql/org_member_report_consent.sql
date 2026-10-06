-- org_member_report_consent.sql
--
-- Per-user reporting for EDU/NGO organisations, to the owner's consent spec
-- (2026-10-05) with the small-N threshold decided 2026-10-06.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- THE SPEC, verbatim from the owner:
--   "if user is using organisational license only then he/she will share the
--    consent. Also there will be one check box in the settings page and if user
--    is using organisational account then the option will be on, otherwise it
--    will be off."
--   "user may decline to accept, or set off the consent option from the
--    setting and in those cases organisational admin will not be able to get
--    that user specific information but will get his/her report in the
--    aggreegated format"
--
-- ⇒ Consent OFF removes someone from IDENTIFICATION, never from the AGGREGATE.
--    Opting out must not shrink the org's totals; that would both under-report
--    the organisation and make the opt-out visible by arithmetic.
-- ─────────────────────────────────────────────────────────────────────────────
--
-- 🔑 WHY THE FLAG LIVES ON org_members AND NOT ON licenses OR auth.users.
-- The spec says consent only ever applies to someone on an organisational
-- licence. Putting it on the membership row makes that true BY CONSTRUCTION
-- rather than by remembering to check:
--   • a personal account has no org_members row at all, so it can never be
--     individually visible to anyone;
--   • leaving the org sets status='removed', so the consent cannot survive the
--     membership and silently apply to a later, personal use of the app;
--   • a user in two orgs consents per org, which is the only coherent reading.
-- A column on `licenses` would have failed all three — licenses is one row per
-- user and outlives any membership.
--
-- DEFAULT true is safe ONLY because of that scoping: it means "on while you are
-- an org member", which is exactly what the owner specified. ⛔ Do not copy this
-- default onto a user-level table.

alter table org_members
  add column if not exists report_consent boolean not null default true;

comment on column org_members.report_consent is
  'Per-(user,org) consent to INDIVIDUAL wellbeing reporting. true = the org admin may see this member''s own trends. false = the admin sees no user-specific data for them, but they ARE still counted in the organisation''s aggregate. Defaults true, and is meaningful only while the membership is active.';

-- Partial index: the individual-reporting query only ever asks for active,
-- consenting members of one org.
create index if not exists org_members_consent_idx
  on org_members (org_id)
  where status = 'active' and report_consent = true;

-- ── The small-N threshold ────────────────────────────────────────────────────
--
-- Owner decision 2026-10-06: **10**. (A floor of 5 was proposed; the owner
-- chose the more conservative figure.)
--
-- Why a threshold exists at all: with a handful of members, a "breakdown" is
-- individual data wearing a different hat, and someone who switched consent OFF
-- can be identified by elimination from the totals. The threshold protects the
-- person who opted out, which is the whole point of letting them opt out.
--
-- Held in SQL so the API and any future report generator cannot drift apart.
create or replace function org_individual_reporting_min_members()
returns integer
language sql
immutable
as $$ select 10 $$;

-- ── One place that answers "may this org see individual data at all?" ────────
--
-- Counts ACTIVE members, not consenting ones. Deliberate: if the threshold
-- moved with the number of people who consented, then each person switching
-- consent off would change whether the breakdown appears — which leaks exactly
-- what the threshold is meant to hide.
create or replace function org_can_show_individual(p_org_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select count(*) >= org_individual_reporting_min_members()
    from org_members
   where org_id = p_org_id
     and status = 'active'
$$;

revoke execute on function org_can_show_individual from public, anon, authenticated;
grant  execute on function org_can_show_individual to service_role;

-- ── Backfill note ────────────────────────────────────────────────────────────
-- Existing members default to true, matching "on when the account is on an
-- organisational licence". No backfill statement is needed, and none should be
-- written that sets anyone to false — that is the member's choice to make.
