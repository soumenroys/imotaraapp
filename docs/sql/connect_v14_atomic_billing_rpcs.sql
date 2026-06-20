-- connect_v14_atomic_billing_rpcs.sql
-- Run in Supabase SQL editor (Dashboard → SQL Editor)
--
-- Two atomic RPCs to fix race conditions in billing and payout:
--
-- 1. credit_imotara_wallet: replaces read-modify-write in wallet/topup/verify.
--    Two concurrent top-up verifications for the same user use separate orders
--    but both write to the same imotara_wallets row. The UPSERT with += prevents
--    one credit from overwriting the other.
--
-- 2. increment_pending_payout: replaces read-modify-write in consultant/payout.
--    A consultant making two simultaneous payout requests could each read the
--    same pending_payout value. The atomic += prevents double-payout.

-- ── 1. Atomic wallet credit (used by topup/verify) ─────────────────────────────

CREATE OR REPLACE FUNCTION credit_imotara_wallet(
  p_user_id      UUID,
  p_amount       NUMERIC,
  p_currency     TEXT DEFAULT 'INR'
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  INSERT INTO imotara_wallets (user_id, balance, currency_code, updated_at)
  VALUES (p_user_id, p_amount, p_currency, now())
  ON CONFLICT (user_id) DO UPDATE
    SET balance    = imotara_wallets.balance + p_amount,
        updated_at = now();
$$;

-- Grant execution to the service-role key used by server-side routes
GRANT EXECUTE ON FUNCTION credit_imotara_wallet(UUID, NUMERIC, TEXT) TO service_role;


-- ── 2. Atomic pending_payout increment (used by consultant/payout) ──────────────

CREATE OR REPLACE FUNCTION increment_pending_payout(
  p_user_id UUID,
  p_amount  NUMERIC
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE connect_wallet
  SET pending_payout = pending_payout + p_amount
  WHERE user_id = p_user_id;
$$;

GRANT EXECUTE ON FUNCTION increment_pending_payout(UUID, NUMERIC) TO service_role;
