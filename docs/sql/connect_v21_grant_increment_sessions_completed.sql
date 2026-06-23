-- connect_v21_grant_increment_sessions_completed.sql
-- Fixes identified in Round-59 schema audit.
-- Run in Supabase SQL editor after connect_v20_app_settings_rls.sql.
--
-- Summary of changes:
-- 1. Grant EXECUTE on increment_sessions_completed to service_role.
--    v15 defined the function but omitted the GRANT. Without it, the
--    service-role client's .rpc("increment_sessions_completed") call returns
--    "permission denied" on a fresh project and every session completion
--    silently falls back to a non-atomic read-modify-write on sessions_completed,
--    defeating the atomicity that v15 was intended to provide.

GRANT EXECUTE ON FUNCTION increment_sessions_completed(uuid) TO service_role;

-- Verify:
-- SELECT has_function_privilege('service_role', 'increment_sessions_completed(uuid)', 'EXECUTE');
-- Expected: t
