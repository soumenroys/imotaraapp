-- connect_v20_app_settings_rls.sql
-- Fixes identified in Round-58 schema audit.
-- Run in Supabase SQL editor after connect_v19_schema_fixes.sql.
--
-- Summary of changes:
-- 1. Enable RLS on app_settings and add a SELECT-only policy.
--    Without RLS, any authenticated user can overwrite the exchange_rates row
--    via the Supabase JS client, corrupting all INR-normalised rate sorting and
--    session billing that falls back to the exchange rate. All writes must go
--    through the service-role client (API routes / cron), never the anon/auth JWT.

-- ─── 1. Enable RLS on app_settings ─────────────────────────────────────────

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- Allow anyone (anon and authenticated) to read settings.
-- The exchange_rates value is public information — no need to restrict reads.
CREATE POLICY "app_settings_public_read"
  ON app_settings
  FOR SELECT
  USING (true);

-- No INSERT / UPDATE / DELETE policies for anon or authenticated roles.
-- All writes come from service-role (exchange-rates cron).
-- Service-role bypasses RLS by default in Supabase.

-- Verify:
-- SELECT relname, relrowsecurity FROM pg_class WHERE relname = 'app_settings';
-- SELECT policyname, cmd FROM pg_policies WHERE tablename = 'app_settings';
