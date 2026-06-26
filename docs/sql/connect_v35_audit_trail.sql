-- connect_v35_audit_trail.sql
-- Cycle-2 DB audit findings. Run AFTER connect_v34_rls_rpc_hardening.sql.
--
-- 1. increment_pending_payout: add updated_at = NOW() (was missing, unlike all other wallet RPCs)
-- 2. connect_sessions status CHECK: remove dead 'accepted' enum value never written by any route

-- ─── 1. increment_pending_payout: set updated_at ──────────────────────────────
--
-- v30 increments pending_payout but omits updated_at. Every other wallet RPC
-- (decrement_pending_payout v34, increment_wallet_earnings v29) sets updated_at.
-- This gap makes audit-trail queries on connect_wallet.updated_at incomplete for
-- payout increment events.

CREATE OR REPLACE FUNCTION increment_pending_payout(
  p_user_id UUID,
  p_amount   NUMERIC
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
     SET pending_payout = pending_payout + p_amount,
         updated_at     = NOW()
   WHERE user_id = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION increment_pending_payout(UUID, NUMERIC) TO service_role;


-- ─── 2. connect_sessions: remove dead 'accepted' status enum value ────────────
--
-- The original schema CHECK includes 'accepted' but no API route or migration
-- ever writes status = 'accepted'. The TRANSITIONS map in sessions/[id]/route.ts
-- maps the 'accept' action directly to 'active'. Dead enum values confuse future
-- readers and can hide bugs if a typo produces a value that silently passes CHECK.
-- Remove it to keep the enum tight.

ALTER TABLE connect_sessions
  DROP CONSTRAINT IF EXISTS connect_sessions_status_check;

ALTER TABLE connect_sessions
  ADD CONSTRAINT connect_sessions_status_check
  CHECK (status IN ('pending', 'active', 'completed', 'declined', 'cancelled'));


-- ─── Verify ───────────────────────────────────────────────────────────────────
-- SELECT prosrc FROM pg_proc WHERE proname = 'increment_pending_payout';
-- -- Should contain updated_at = NOW()
--
-- SELECT conname, consrc FROM pg_constraint
--  WHERE conrelid = 'connect_sessions'::regclass AND contype = 'c';
-- -- Should show status IN (...) WITHOUT 'accepted'
