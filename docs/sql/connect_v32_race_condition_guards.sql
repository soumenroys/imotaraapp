-- connect_v32_race_condition_guards.sql
-- Correctness gaps identified in Round-87 DB audit.
-- Run in Supabase SQL editor AFTER connect_v31_wallet_payout_hardening.sql.
-- Apply statements one at a time.
--
-- Summary:
-- 1. connect_sessions: partial unique index on (user_id, consultant_id) WHERE status='pending'
--    Prevents duplicate pending sessions for the same user+consultant pair via concurrent POST.
--    Application-level guard (read-then-write) has a race window; DB index is authoritative.
-- 2. connect_wallet: CHECK constraint pending_payout <= earned_amount
--    Prevents concurrent payout requests from both passing the application-level available-
--    balance check and together incrementing pending_payout beyond earned_amount.


-- ─── 1. Partial unique index: one pending session per user+consultant pair ───────────
--
-- Without this, two concurrent POST /api/connect/sessions requests from the same user
-- for the same consultant both pass the application-level maybeSingle() check (both
-- read 0 existing pending sessions before either inserts) and both INSERT, creating
-- duplicate pending sessions. The unique index causes the second INSERT to fail with
-- 23505 unique_violation, which the application maps to a 409 "already pending" response.
--
-- PRE-FLIGHT: verify no existing rows violate uniqueness before adding:
--   SELECT user_id, consultant_id, COUNT(*) AS cnt
--   FROM connect_sessions
--   WHERE status = 'pending'
--   GROUP BY user_id, consultant_id
--   HAVING COUNT(*) > 1;
--   (Resolve any duplicates by cancelling the older rows before running this migration.)

CREATE UNIQUE INDEX IF NOT EXISTS uq_connect_sessions_user_consultant_pending
  ON connect_sessions (user_id, consultant_id)
  WHERE status = 'pending';


-- ─── 2. connect_wallet: pending_payout <= earned_amount invariant ─────────────────────
--
-- connect_v27 added individual non-negative CHECKs but no cross-column invariant.
-- Two concurrent payout requests both passing the available-balance check
-- (earned_amount - pending_payout > 0) before either writes can each increment
-- pending_payout, resulting in pending_payout > earned_amount with no DB backstop.
--
-- PRE-FLIGHT: verify no existing rows violate the invariant before adding:
--   SELECT user_id, earned_amount, pending_payout
--   FROM connect_wallet
--   WHERE pending_payout > earned_amount;
--   (Resolve any violations by zeroing pending_payout for the affected rows after confirming
--   no payout request is legitimately in-flight for them.)

ALTER TABLE connect_wallet
  ADD CONSTRAINT connect_wallet_payout_le_earned
  CHECK (pending_payout <= earned_amount);
