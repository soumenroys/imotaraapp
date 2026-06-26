-- connect_v33_final_hardening.sql
-- Round-89 DB audit: final hardening items.
-- Run in Supabase SQL editor AFTER connect_v32_race_condition_guards.sql.
--
-- Summary:
-- 1. connect_consultants: explicit INSERT deny policy — all other Connect tables received
--    explicit deny policies in v30-v31; connect_consultants was left on implicit-deny
--    (no INSERT policy = deny for non-service_role callers). Making it explicit ensures
--    the deny survives any future accidental GRANT to the authenticated role.
--    All production registrations go through getSupabaseAdmin() (service_role, BYPASSRLS).


-- ─── 1. connect_consultants: explicit INSERT deny ─────────────────────────────

DROP POLICY IF EXISTS "connect_consultants_no_direct_insert" ON connect_consultants;

CREATE POLICY "connect_consultants_no_direct_insert"
  ON connect_consultants
  FOR INSERT
  WITH CHECK (false);
