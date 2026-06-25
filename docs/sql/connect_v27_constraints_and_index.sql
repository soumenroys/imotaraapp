-- connect_v27: data-integrity constraints + performance index
-- Run after connect_v26_session_notes_content_length.sql

-- 1. connect_payouts: amount must be positive.
--    The application validates amount > 0 at the API layer, so existing rows are
--    expected to be clean. If this statement fails, investigate existing zero/negative rows.
ALTER TABLE connect_payouts
  ADD CONSTRAINT connect_payouts_amount_positive CHECK (amount > 0);

-- 2. connect_wallet: all balance columns must be non-negative.
--    RPCs use GREATEST(0, ...) so existing rows should satisfy these constraints.
--    If this statement fails, investigate existing negative-balance wallet rows.
ALTER TABLE connect_wallet
  ADD CONSTRAINT connect_wallet_balance_nonneg  CHECK (balance_amount  >= 0),
  ADD CONSTRAINT connect_wallet_earned_nonneg   CHECK (earned_amount   >= 0),
  ADD CONSTRAINT connect_wallet_pending_nonneg  CHECK (pending_payout  >= 0);

-- 3. Performance index for the double-booking query added in round-70:
--    SELECT id FROM connect_sessions
--    WHERE consultant_id = $1 AND status IN ('pending','active') AND scheduled_at BETWEEN ...
--    The existing idx_connect_sessions_consultant_status (consultant_id, status) covers this
--    query, but the additional scheduled_at range predicate benefits from including it.
--    Also covers: WHERE user_id = $1 AND consultant_id = $2 AND status IN (...)
CREATE INDEX IF NOT EXISTS idx_connect_sessions_user_consultant_status
  ON connect_sessions (user_id, consultant_id, status);
