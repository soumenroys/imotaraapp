-- connect_v18_wallet_balance_rpc.sql
-- Run in Supabase SQL editor after connect_v17_atomic_ops.sql.
--
-- Adds decrement_wallet_balance(user_id, amount) — an atomic UPDATE expression
-- that replaces the JS read-modify-write pattern in the refund approval route.
--
-- Problem it solves:
--   The refund PATCH previously did:
--     1. SELECT balance FROM imotara_wallets WHERE user_id = ...
--     2. newBalance = max(0, balance - refundAmount)  ← computed in JS
--     3. UPDATE imotara_wallets SET balance = newBalance
--   If the user topped up their wallet between steps 1 and 3, step 3 silently
--   overwrote the deposit — the user lost money they legitimately added.
--
--   The fix: a single UPDATE expression evaluated at row-lock time in Postgres,
--   identical to the decrement_pending_payout pattern added in v17.

CREATE OR REPLACE FUNCTION decrement_wallet_balance(p_user_id UUID, p_amount NUMERIC)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE imotara_wallets
  SET
    balance    = GREATEST(0, balance - p_amount),
    status     = 'active',
    updated_at = NOW()
  WHERE user_id = p_user_id;
END;
$$;
