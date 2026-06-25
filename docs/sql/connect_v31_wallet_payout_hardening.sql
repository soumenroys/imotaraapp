-- connect_v31_wallet_payout_hardening.sql
-- Correctness gaps identified in Round-85 DB audit.
-- Run in Supabase SQL editor AFTER connect_v30_rpc_hardening.sql.
-- Apply statements one at a time.
--
-- PRE-FLIGHT:
--   SELECT id FROM connect_sessions WHERE rating IS NOT NULL AND (rating < 1 OR rating > 5);
--   (Inspect any returned rows before adding the rating range CHECK.)
--
-- Summary:
-- 1-3. connect_wallet: explicit INSERT/UPDATE/DELETE deny policies (v30 fixed connect_recharges;
--      connect_wallet had only SELECT policy + implicit-deny for write paths).
-- 4-6. connect_payouts: explicit INSERT/UPDATE/DELETE deny policies (same pattern).
-- 7.   connect_sessions: rating column range CHECK constraint (1–5) — currently an authenticated
--      user on a completed session can submit rating=100 or rating=-5 via direct client call,
--      corrupting the aggregate in update_consultant_rating().


-- ─── 1. connect_wallet: explicit INSERT deny ──────────────────────────────────

DROP POLICY IF EXISTS "connect_wallet_no_direct_insert" ON connect_wallet;

CREATE POLICY "connect_wallet_no_direct_insert"
  ON connect_wallet
  FOR INSERT
  WITH CHECK (false);


-- ─── 2. connect_wallet: explicit UPDATE deny ──────────────────────────────────

DROP POLICY IF EXISTS "connect_wallet_no_direct_update" ON connect_wallet;

CREATE POLICY "connect_wallet_no_direct_update"
  ON connect_wallet
  FOR UPDATE
  USING (false);


-- ─── 3. connect_wallet: explicit DELETE deny ──────────────────────────────────

DROP POLICY IF EXISTS "connect_wallet_no_direct_delete" ON connect_wallet;

CREATE POLICY "connect_wallet_no_direct_delete"
  ON connect_wallet
  FOR DELETE
  USING (false);


-- ─── 4. connect_payouts: explicit INSERT deny ─────────────────────────────────

DROP POLICY IF EXISTS "connect_payouts_no_direct_insert" ON connect_payouts;

CREATE POLICY "connect_payouts_no_direct_insert"
  ON connect_payouts
  FOR INSERT
  WITH CHECK (false);


-- ─── 5. connect_payouts: explicit UPDATE deny ─────────────────────────────────

DROP POLICY IF EXISTS "connect_payouts_no_direct_update" ON connect_payouts;

CREATE POLICY "connect_payouts_no_direct_update"
  ON connect_payouts
  FOR UPDATE
  USING (false);


-- ─── 6. connect_payouts: explicit DELETE deny ─────────────────────────────────

DROP POLICY IF EXISTS "connect_payouts_no_direct_delete" ON connect_payouts;

CREATE POLICY "connect_payouts_no_direct_delete"
  ON connect_payouts
  FOR DELETE
  USING (false);


-- ─── 7. connect_sessions: rating range CHECK ──────────────────────────────────
--
-- The v29 UPDATE policy allows rating changes only when status='completed' but does not
-- enforce the 1–5 range. An authenticated user on a completed session can write
-- rating=100 or rating=-5 via the Supabase JS client, corrupting update_consultant_rating()
-- aggregate (which takes AVG). The column-level CHECK covers all write paths including
-- service_role, so it is more robust than extending the RLS policy.
--
-- PRE-FLIGHT: verify no existing rows violate the range before adding:
--   SELECT id FROM connect_sessions WHERE rating IS NOT NULL AND (rating < 1 OR rating > 5);

ALTER TABLE connect_sessions
  ADD CONSTRAINT connect_sessions_rating_range
  CHECK (rating IS NULL OR (rating >= 1 AND rating <= 5));
