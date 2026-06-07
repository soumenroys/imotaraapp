-- Migration v2: Wallet expiry + forfeiture tracking
-- Run AFTER imotara_wallet_migration.sql
-- Run in Supabase SQL editor

-- Add expiry tracking columns to imotara_wallets
ALTER TABLE imotara_wallets
  ADD COLUMN IF NOT EXISTS last_activity_at  timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS expires_at         timestamptz NOT NULL DEFAULT (now() + interval '2 years'),
  ADD COLUMN IF NOT EXISTS expiry_notified_at timestamptz,
  ADD COLUMN IF NOT EXISTS status             text NOT NULL DEFAULT 'active'
                           CHECK (status IN ('active', 'expired', 'forfeited')),
  ADD COLUMN IF NOT EXISTS forfeited_at       timestamptz,
  ADD COLUMN IF NOT EXISTS forfeited_amount   numeric(10, 2);

-- Drop and recreate the type CHECK to add 'forfeiture' to transaction types
ALTER TABLE imotara_wallet_transactions
  DROP CONSTRAINT IF EXISTS imotara_wallet_transactions_type_check;

ALTER TABLE imotara_wallet_transactions
  ADD CONSTRAINT imotara_wallet_transactions_type_check
  CHECK (type IN ('topup', 'deduction', 'refund', 'forfeiture'));

-- Index for cron queries (find wallets expiring soon or already expired)
CREATE INDEX IF NOT EXISTS idx_imotara_wallets_expires_at
  ON imotara_wallets (expires_at)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_imotara_wallets_notify
  ON imotara_wallets (expires_at, expiry_notified_at)
  WHERE status = 'active';

-- Auto-update expires_at whenever last_activity_at changes
CREATE OR REPLACE FUNCTION imotara_wallet_refresh_expiry()
RETURNS TRIGGER AS $$
BEGIN
  NEW.expires_at := NEW.last_activity_at + interval '2 years';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_wallet_expiry ON imotara_wallets;
CREATE TRIGGER trg_wallet_expiry
  BEFORE INSERT OR UPDATE OF last_activity_at
  ON imotara_wallets
  FOR EACH ROW EXECUTE FUNCTION imotara_wallet_refresh_expiry();
