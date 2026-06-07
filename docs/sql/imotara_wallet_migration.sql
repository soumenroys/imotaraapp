-- Migration: Imotara unified wallet (INR balance per user)
-- Run in Supabase SQL editor

-- User wallet — single balance row per user
CREATE TABLE IF NOT EXISTS imotara_wallets (
  user_id       uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  balance       numeric(10, 2) NOT NULL DEFAULT 0 CHECK (balance >= 0),
  currency_code text NOT NULL DEFAULT 'INR',
  updated_at    timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE imotara_wallets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users_own_wallet" ON imotara_wallets;
CREATE POLICY "users_own_wallet" ON imotara_wallets
  FOR ALL USING (auth.uid() = user_id);

-- Transaction log — topups, deductions, refunds
CREATE TABLE IF NOT EXISTS imotara_wallet_transactions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type                text NOT NULL CHECK (type IN ('topup', 'deduction', 'refund')),
  amount              numeric(10, 2) NOT NULL,
  currency_code       text NOT NULL DEFAULT 'INR',
  description         text,
  session_id          uuid,
  razorpay_payment_id text,
  razorpay_order_id   text,
  created_at          timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE imotara_wallet_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users_own_wallet_transactions" ON imotara_wallet_transactions;
CREATE POLICY "users_own_wallet_transactions" ON imotara_wallet_transactions
  FOR ALL USING (auth.uid() = user_id);

-- Pending Razorpay topup orders (before payment confirmed)
CREATE TABLE IF NOT EXISTS imotara_wallet_orders (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  razorpay_order_id   text NOT NULL UNIQUE,
  razorpay_payment_id text,
  amount              numeric(10, 2) NOT NULL,
  currency_code       text NOT NULL DEFAULT 'INR',
  status              text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
  created_at          timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE imotara_wallet_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users_own_wallet_orders" ON imotara_wallet_orders;
CREATE POLICY "users_own_wallet_orders" ON imotara_wallet_orders
  FOR ALL USING (auth.uid() = user_id);
