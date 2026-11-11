-- docs/sql/visit_tallies_funnel.sql — #129 (11 Nov 2026): anonymous FUNNEL counts.
--
-- Adds ONE tally kind, 'funnel', to visit_tallies. Same privacy as the rest of the
-- table: a daily count per platform + step number, nothing about who. Steps
-- (bucket numbers) are defined in src/lib/analytics/visitTally.ts (FUNNEL_STEPS):
--   1 invite_shown · 2 invite_accepted · 3 invite_declined
--   4 welcome_shown · 5 welcome_pick · 6 welcome_fresh · 7 checkin_opened
--   8 upgrade_view · 9 checkout_start · 10 purchase_ok · 11 purchase_cancel · 12 quota_hit
--
-- ⚠️ Run in the Supabase SQL editor (owner). Until it is run, funnel tallies are
--    refused by the constraint and dropped silently — nothing else is affected.

begin;

alter table public.visit_tallies drop constraint if exists visit_tallies_kind_chk;
alter table public.visit_tallies add constraint visit_tallies_kind_chk
    check (kind in ('visit_age', 'session_messages', 'session_minutes', 'funnel'));

commit;

-- ── Proving it (should list the four kinds) ──────────────────────────────────
-- select pg_get_constraintdef(oid) from pg_constraint where conname = 'visit_tallies_kind_chk';
