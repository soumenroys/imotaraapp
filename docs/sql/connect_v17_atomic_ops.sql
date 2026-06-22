-- connect_v17_atomic_ops.sql
-- Run in Supabase SQL editor after connect_v16_security_hardening.sql.
-- Implements two atomic DB functions that replace JavaScript read-modify-write patterns:
--
--   1. get_session_balance(user_id, consultant_id)
--      Computes a user's remaining minute-balance for a consultant in a single
--      SQL expression. Replaces the two-round-trip pattern in the tick and session-
--      creation routes (read recharges, read sessions, subtract in JS). Single SQL
--      aggregation means a concurrent tick or recharge cannot land between the two
--      reads and produce a stale balance.
--
--   2. decrement_pending_payout(user_id, amount)
--      Atomically decrements connect_wallet.pending_payout by exactly `amount`.
--      Replaces the JS read-compute-write pattern in the payout admin route which
--      had a race window where two concurrent completions could both read the same
--      pending_payout value, then both write `value - amount`, effectively dropping
--      one decrement. A single UPDATE expression in Postgres acquires a row lock
--      and evaluates the new value from the latest committed row — no extra
--      SELECT FOR UPDATE needed.

-- ─── 1. ATOMIC SESSION BALANCE ────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_session_balance(p_user_id UUID, p_consultant_id UUID)
RETURNS NUMERIC
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE(
      (SELECT SUM(r.minutes_credited)
       FROM connect_recharges r
       WHERE r.user_id        = p_user_id
         AND r.consultant_id  = p_consultant_id
         AND r.status         = 'completed'),
      0
    )
    -
    COALESCE(
      (SELECT SUM(s.minutes_used)
       FROM connect_sessions s
       WHERE s.user_id        = p_user_id
         AND s.consultant_id  = p_consultant_id
         AND s.status IN ('completed', 'active')),
      0
    );
$$;

-- ─── 2. ATOMIC PAYOUT DECREMENT ───────────────────────────────────────────────

CREATE OR REPLACE FUNCTION decrement_pending_payout(p_user_id UUID, p_amount NUMERIC)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Single UPDATE expression: Postgres evaluates `pending_payout - p_amount`
  -- using the value locked at UPDATE time, not a prior SELECT, eliminating the
  -- read-modify-write race between concurrent payout completions for the same consultant.
  UPDATE connect_wallet
  SET
    pending_payout = GREATEST(0, pending_payout - p_amount),
    updated_at     = NOW()
  WHERE user_id = p_user_id;
END;
$$;
