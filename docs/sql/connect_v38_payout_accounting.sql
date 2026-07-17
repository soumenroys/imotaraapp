-- connect_v38_payout_accounting.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- FIX: completed payouts never debited earned_amount.
--
-- Before this migration, completing a payout called decrement_pending_payout()
-- (v17), which only releases the pending hold. Because a consultant's
-- available balance is computed as (earned_amount - pending_payout), the same
-- lifetime earnings became withdrawable AGAIN after every completed payout —
-- a consultant could repeatedly request payout of their full earned_amount.
--
-- This migration:
--   1. Adds finalize_completed_payout(): atomically debits BOTH earned_amount
--      and pending_payout when a payout completes. (Failed payouts continue to
--      use decrement_pending_payout — the money was never sent, so earnings
--      must be preserved and only the hold released.)
--   2. Runs a GUARDED one-time backfill that debits historical completed
--      payouts from earned_amount, so balances are correct going forward.
--      The guard (connect_migration_markers) makes re-running this file safe.
--
-- Apply AFTER connect_v37. Deploy the matching app change (payouts route
-- calling finalize_completed_payout on completion) with or after this.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── 1. Atomic completion: debit earnings + release hold in one UPDATE ───────

CREATE OR REPLACE FUNCTION finalize_completed_payout(p_user_id UUID, p_amount NUMERIC)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'finalize_completed_payout: amount must be positive';
  END IF;

  -- Single UPDATE expression, same race-safety rationale as v17: both columns
  -- are computed from the row values locked at UPDATE time, so concurrent
  -- completions cannot interleave a stale read.
  UPDATE connect_wallet
  SET
    earned_amount  = GREATEST(0, earned_amount  - p_amount),
    pending_payout = GREATEST(0, pending_payout - p_amount),
    updated_at     = NOW()
  WHERE user_id = p_user_id;
END;
$$;

REVOKE ALL ON FUNCTION finalize_completed_payout(UUID, NUMERIC) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION finalize_completed_payout(UUID, NUMERIC) TO service_role;

-- ─── 2. Guarded one-time backfill for historical completed payouts ───────────
-- Debits each consultant's earned_amount by the total of their ALREADY
-- COMPLETED payouts (which were never debited before this fix). The marker
-- table guarantees the backfill runs at most once even if this file is
-- pasted into the SQL editor again.

CREATE TABLE IF NOT EXISTS connect_migration_markers (
  key        text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM connect_migration_markers WHERE key = 'v38_payout_backfill'
  ) THEN
    UPDATE connect_wallet w
    SET
      earned_amount = GREATEST(0, w.earned_amount - p.total_paid),
      updated_at    = NOW()
    FROM (
      SELECT consultant_user_id, SUM(amount) AS total_paid
      FROM connect_payouts
      WHERE status = 'completed'
      GROUP BY consultant_user_id
    ) p
    WHERE w.user_id = p.consultant_user_id;

    INSERT INTO connect_migration_markers (key) VALUES ('v38_payout_backfill');
  END IF;
END;
$$;

-- ─── 3. Verification ─────────────────────────────────────────────────────────
-- a) Function exists and is service-role-only:
--    SELECT has_function_privilege('service_role', 'finalize_completed_payout(uuid,numeric)', 'EXECUTE');  -- true
--    SELECT has_function_privilege('anon',         'finalize_completed_payout(uuid,numeric)', 'EXECUTE');  -- false
-- b) Backfill ran exactly once:
--    SELECT * FROM connect_migration_markers WHERE key = 'v38_payout_backfill';
-- c) No consultant's lifetime completed payouts exceed their remaining
--    earned_amount + those payouts (sanity — should return 0 rows):
--    SELECT w.user_id, w.earned_amount, w.pending_payout, p.total_paid
--    FROM connect_wallet w
--    JOIN (SELECT consultant_user_id, SUM(amount) AS total_paid
--          FROM connect_payouts WHERE status='completed'
--          GROUP BY consultant_user_id) p ON p.consultant_user_id = w.user_id
--    WHERE w.earned_amount < 0 OR w.pending_payout < 0;
