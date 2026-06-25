-- connect_v30_rpc_hardening.sql
-- Correctness gaps identified in Round-82 audit.
-- Run in Supabase SQL editor AFTER connect_v29_rls_schema_hardening.sql.
-- Apply statements one at a time.
--
-- PRE-FLIGHT: No table-scan risks; these are function replacements + policy adds.
-- Safe to run on live traffic (no table rewrites, no index builds on large tables).
--
-- Summary:
-- 1. increment_pending_payout: add p_amount > 0 guard (mirrors v29 fix to increment_wallet_earnings).
--    Without this guard a p_amount <= 0 call decrements pending_payout, which underflows the
--    connect_wallet_pending_nonneg CHECK constraint (from v27) with an opaque 23514 error.
-- 2. connect_recharges: add explicit INSERT deny policy (currently implicit-deny by RLS default;
--    making it explicit survives any future accidental GRANT to authenticated role).


-- ─── 1. increment_pending_payout: p_amount > 0 guard ─────────────────────────
--
-- v14 defined this as a plain SQL function with no input validation.
-- v29 added the same guard to increment_wallet_earnings but missed this twin function.
-- Rewrite as plpgsql to allow the IF/RAISE.

CREATE OR REPLACE FUNCTION increment_pending_payout(
  p_user_id UUID,
  p_amount  NUMERIC
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'increment_pending_payout: p_amount must be positive, got %', p_amount;
  END IF;
  UPDATE connect_wallet
     SET pending_payout = pending_payout + p_amount
   WHERE user_id = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION increment_pending_payout(UUID, NUMERIC) TO service_role;


-- ─── 2. connect_recharges: explicit INSERT deny policy ────────────────────────
--
-- RLS is enabled on connect_recharges but no INSERT policy exists — protection is
-- implicit (no INSERT policy = deny for non-service_role callers). This is correct
-- but fragile: a future GRANT to the authenticated role would silently lift the deny.
-- An explicit WITH CHECK (false) makes the intent durable regardless of future grants.
-- All production recharge inserts go through getSupabaseAdmin() (service_role,
-- BYPASSRLS) so this policy does not affect any existing code path.

DROP POLICY IF EXISTS "connect_recharges_no_direct_insert" ON connect_recharges;

CREATE POLICY "connect_recharges_no_direct_insert"
  ON connect_recharges
  FOR INSERT
  WITH CHECK (false);
