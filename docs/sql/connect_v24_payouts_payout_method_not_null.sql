-- connect_v24_payouts_payout_method_not_null.sql
-- Fixes identified in Round-62 schema audit.
-- Run in Supabase SQL editor after connect_v23_notes_rls_and_blocks_policy.sql.
--
-- Summary of changes:
-- 1. Add NOT NULL to connect_payouts.payout_method.
--    The column had a CHECK (payout_method IN ('upi','bank','paypal')) but was
--    nullable. In Postgres, NULL IN (...) evaluates to UNKNOWN (not FALSE), so
--    the CHECK constraint passes for NULL — a service-role INSERT with
--    payout_method = NULL would succeed, producing a row that causes runtime
--    failures in any display or report code that uses the field without a null
--    guard. The only insert path (the payout POST route) always supplies a value,
--    so this migration will not fail on existing data.

ALTER TABLE connect_payouts
  ALTER COLUMN payout_method SET NOT NULL;

-- Verify:
-- SELECT column_name, is_nullable
--   FROM information_schema.columns
--  WHERE table_name = 'connect_payouts' AND column_name = 'payout_method';
-- Expected: is_nullable = 'NO'
