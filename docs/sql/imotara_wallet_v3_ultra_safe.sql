-- Migration v3: Ultra-safe wallet policy — notifications log, consent records, refund requests
-- Run AFTER v1 + v2 migrations.
-- Run in Supabase SQL editor.

-- ── 1. Update wallet status to remove 'forfeited', add 'dormant' ──────────────
-- Balance is NEVER zeroed automatically. Dormant = inactive, but refundable always.
ALTER TABLE imotara_wallets
  DROP CONSTRAINT IF EXISTS imotara_wallets_status_check;
ALTER TABLE imotara_wallets
  ADD CONSTRAINT imotara_wallets_status_check
  CHECK (status IN ('active', 'dormant', 'refund_requested', 'refunded'));

-- Remove forfeiture columns if they were added in v2 (clean slate)
ALTER TABLE imotara_wallets
  DROP COLUMN IF EXISTS forfeited_at,
  DROP COLUMN IF EXISTS forfeited_amount;

-- Add dormancy tracking
ALTER TABLE imotara_wallets
  ADD COLUMN IF NOT EXISTS dormant_at               timestamptz,
  ADD COLUMN IF NOT EXISTS annual_statement_sent_at  timestamptz;

-- Track each reminder milestone separately (to avoid duplicate sends)
ALTER TABLE imotara_wallets
  ADD COLUMN IF NOT EXISTS notified_180d_at timestamptz,
  ADD COLUMN IF NOT EXISTS notified_90d_at  timestamptz,
  ADD COLUMN IF NOT EXISTS notified_30d_at  timestamptz,
  ADD COLUMN IF NOT EXISTS notified_14d_at  timestamptz,
  ADD COLUMN IF NOT EXISTS notified_7d_at   timestamptz,
  ADD COLUMN IF NOT EXISTS notified_1d_at   timestamptz,
  ADD COLUMN IF NOT EXISTS notified_dormant_at timestamptz;

-- ── 2. Notification audit log (every email ever sent) ─────────────────────────
CREATE TABLE IF NOT EXISTS imotara_wallet_notifications (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  notification_type text NOT NULL,
  -- e.g. '180d_warning', '90d_warning', '30d_warning', '14d_warning',
  --       '7d_warning', '1d_warning', 'dormant_notice', 'annual_statement'
  email_to          text,
  subject           text,
  wallet_balance    numeric(10, 2),
  expires_at        timestamptz,
  sent_at           timestamptz NOT NULL DEFAULT now(),
  delivery_status   text NOT NULL DEFAULT 'sent' CHECK (delivery_status IN ('sent', 'failed', 'skipped'))
);
ALTER TABLE imotara_wallet_notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users_own_wallet_notifications" ON imotara_wallet_notifications;
CREATE POLICY "users_own_wallet_notifications" ON imotara_wallet_notifications
  FOR SELECT USING (auth.uid() = user_id);

-- ── 3. Explicit consent records (one per top-up) ──────────────────────────────
CREATE TABLE IF NOT EXISTS imotara_wallet_consents (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  terms_version  text NOT NULL DEFAULT 'v1.0',
  accepted_at    timestamptz NOT NULL DEFAULT now(),
  top_up_amount  numeric(10, 2),
  razorpay_order_id text,
  ip_address     text,
  user_agent     text
);
ALTER TABLE imotara_wallet_consents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users_own_wallet_consents" ON imotara_wallet_consents;
CREATE POLICY "users_own_wallet_consents" ON imotara_wallet_consents
  FOR SELECT USING (auth.uid() = user_id);

-- ── 4. Refund request table ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS imotara_wallet_refund_requests (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  requested_at     timestamptz NOT NULL DEFAULT now(),
  amount           numeric(10, 2) NOT NULL,
  currency_code    text NOT NULL DEFAULT 'INR',
  bank_name        text,
  account_number   text,
  ifsc_code        text,
  account_holder   text,
  upi_id           text,
  reason           text,
  status           text NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'processing', 'completed', 'rejected')),
  reference_number text UNIQUE,
  admin_notes      text,
  processed_at     timestamptz
);
ALTER TABLE imotara_wallet_refund_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users_own_refund_requests" ON imotara_wallet_refund_requests;
CREATE POLICY "users_own_refund_requests" ON imotara_wallet_refund_requests
  FOR ALL USING (auth.uid() = user_id);

-- ── 5. Update transaction type constraint to remove 'forfeiture' ──────────────
ALTER TABLE imotara_wallet_transactions
  DROP CONSTRAINT IF EXISTS imotara_wallet_transactions_type_check;
ALTER TABLE imotara_wallet_transactions
  ADD CONSTRAINT imotara_wallet_transactions_type_check
  CHECK (type IN ('topup', 'deduction', 'refund', 'dormancy_marked'));
-- Note: balance is NEVER zeroed via a transaction. 'dormancy_marked' is an event log only.

-- ── 6. Indexes ────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_wallet_notifications_user  ON imotara_wallet_notifications (user_id, notification_type, sent_at);
CREATE INDEX IF NOT EXISTS idx_wallet_consents_user       ON imotara_wallet_consents (user_id, accepted_at);
CREATE INDEX IF NOT EXISTS idx_refund_requests_user       ON imotara_wallet_refund_requests (user_id, status);
CREATE INDEX IF NOT EXISTS idx_wallets_active_expiry      ON imotara_wallets (expires_at, status) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_wallets_annual_statement   ON imotara_wallets (annual_statement_sent_at) WHERE status = 'active';
