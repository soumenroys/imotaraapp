-- admin_v1_rls_lockdown.sql
-- Fixes a CRITICAL issue flagged by Supabase's automated security advisor
-- (2026-07-14): rls_disabled_in_public.
--
-- Summary: super_admins, admin_sessions, admin_login_audit,
-- admin_password_resets, and admin_license_history were created with no RLS
-- enabled and no policies. Verified live: the public anon key can read
-- super_admins (including password_hash/totp_secret columns) and
-- admin_sessions directly via the auto-generated PostgREST API, completely
-- bypassing the app's own custom admin-auth system. With no policies,
-- writes/deletes are very likely exposed the same way — full authentication
-- bypass to platform ownership, reachable with zero credentials.
--
-- Fix: enable RLS with NO policies on all five tables. None of them should
-- ever be reachable by the anon or authenticated Postgres roles — every
-- access to these tables already goes exclusively through
-- src/lib/supabaseServer.ts's getSupabaseAdmin() (the service-role client),
-- confirmed across admin auth (_auth.ts), login, and the super-admins CRUD
-- routes. Service-role bypasses RLS by default in Supabase, so this is a
-- zero-code-change, zero-functional-impact fix — it only removes the public
-- exposure. Same pattern already used for app_settings in
-- connect_v20_app_settings_rls.sql (that one needed a public-read policy
-- since exchange rates are legitimately public; none of these five need any
-- policy at all).

ALTER TABLE super_admins            ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_sessions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_login_audit       ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_password_resets   ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_license_history   ENABLE ROW LEVEL SECURITY;

-- No policies added for any of the five — RLS enabled with zero policies
-- means zero rows are visible/writable to anon or authenticated, full stop.
-- service_role (used exclusively by getSupabaseAdmin()) bypasses RLS
-- regardless, so the admin panel itself is entirely unaffected.

-- Verify after running:
-- SELECT relname, relrowsecurity FROM pg_class
--   WHERE relname IN ('super_admins','admin_sessions','admin_login_audit','admin_password_resets','admin_license_history');
-- -- all five should show relrowsecurity = true, and:
-- SELECT policyname, tablename FROM pg_policies
--   WHERE tablename IN ('super_admins','admin_sessions','admin_login_audit','admin_password_resets','admin_license_history');
-- -- should return zero rows.
