-- connect_v25_recharges_refunded_status.sql
-- Fixes identified in Round-63 schema audit.
-- Run in Supabase SQL editor after connect_v24_payouts_payout_method_not_null.sql.
--
-- Summary of changes:
-- 1. Add 'refunded' to connect_recharges.status CHECK constraint.
--    The Razorpay webhook handler (src/app/api/payments/razorpay/webhook/route.ts:292)
--    writes status = 'refunded' when a refund.processed event arrives for a Connect
--    recharge. The original CHECK constraint only allows ('pending','completed','failed'),
--    so any refund event causes a Postgres CHECK violation — the UPDATE is rejected,
--    the webhook returns 500, and the recharge row stays permanently 'completed'.
--    This causes the balance RPC (get_session_balance) to continue counting the
--    refunded recharge toward the user's available minutes even after the money has
--    been returned, allowing the user to start sessions they should no longer have
--    credit for.

-- ─── 1. Add 'refunded' to connect_recharges.status CHECK constraint ──────────

ALTER TABLE connect_recharges
  DROP CONSTRAINT IF EXISTS connect_recharges_status_check;

ALTER TABLE connect_recharges
  ADD CONSTRAINT connect_recharges_status_check
  CHECK (status IN ('pending', 'completed', 'failed', 'refunded'));

-- Note: get_session_balance (connect_v17) already filters with status = 'completed',
-- so 'refunded' rows are correctly excluded from the available-minutes calculation
-- once this constraint allows the webhook to write the value.

-- Verify:
-- SELECT conname, pg_get_constraintdef(oid)
--   FROM pg_constraint
--  WHERE conrelid = 'connect_recharges'::regclass AND conname = 'connect_recharges_status_check';
-- Expected: CHECK (status IN ('pending', 'completed', 'failed', 'refunded'))
