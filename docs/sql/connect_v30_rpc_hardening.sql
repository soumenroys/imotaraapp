-- connect_v30_rpc_hardening.sql
-- Correctness gaps identified in Round-82 audit.
-- Run in Supabase SQL editor AFTER connect_v29_rls_schema_hardening.sql.
-- Apply statements one at a time.
--
-- PRE-FLIGHT: No table-scan risks; these are function replacements + policy adds.
-- Safe to run on live traffic (no table rewrites, no index builds on large tables).
--
-- Summary:
-- 1. increment_pending_payout: add p_amount > 0 guard (mirrors v29 fix to increment_wallet_earnings).
--    Without this guard a p_amount <= 0 call decrements pending_payout, which underflows the
--    connect_wallet_pending_nonneg CHECK constraint (from v27) with an opaque 23514 error.
-- 2. connect_recharges: add explicit INSERT deny policy (currently implicit-deny by RLS default;
--    making it explicit survives any future accidental GRANT to authenticated role).


-- ─── 1. increment_pending_payout: p_amount > 0 guard ─────────────────────────
--
-- v14 defined this as a plain SQL function with no input validation.
-- v29 added the same guard to increment_wallet_earnings but missed this twin function.
-- Rewrite as plpgsql to allow the IF/RAISE.

CREATE OR REPLACE FUNCTION increment_pending_payout(
  p_user_id UUID,
  p_amount  NUMERIC
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
     SET pending_payout = pending_payout + p_amount
   WHERE user_id = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION increment_pending_payout(UUID, NUMERIC) TO service_role;


-- ─── 2. connect_recharges: explicit INSERT deny policy ────────────────────────
--
-- RLS is enabled on connect_recharges but no INSERT policy exists — protection is
-- implicit (no INSERT policy = deny for non-service_role callers). This is correct
-- but fragile: a future GRANT to the authenticated role would silently lift the deny.
-- An explicit WITH CHECK (false) makes the intent durable regardless of future grants.
-- All production recharge inserts go through getSupabaseAdmin() (service_role,
-- BYPASSRLS) so this policy does not affect any existing code path.

DROP POLICY IF EXISTS "connect_recharges_no_direct_insert" ON connect_recharges;

CREATE POLICY "connect_recharges_no_direct_insert"
  ON connect_recharges
  FOR INSERT
  WITH CHECK (false);


-- ─── 3. connect_recharges: explicit UPDATE deny policy ────────────────────────
--
-- v30-item-2 hardened INSERT; UPDATE was left on implicit-deny only. A user with a
-- valid JWT could change minutes_credited or status on a pending row (e.g. bump
-- minutes_credited to 99999 before the verify call) if implicit deny is ever lifted.
-- All legitimate updates go through service_role (BYPASSRLS) and are unaffected.

DROP POLICY IF EXISTS "connect_recharges_no_direct_update" ON connect_recharges;

CREATE POLICY "connect_recharges_no_direct_update"
  ON connect_recharges
  FOR UPDATE
  USING (false);


-- ─── 4. connect_sessions: explicit DELETE deny policy ─────────────────────────
--
-- No DELETE policy existed — implicit-deny is currently protective but fragile.
-- connect_messages has ON DELETE CASCADE from connect_sessions, so a session deletion
-- would cascade-wipe the entire message history, destroying the billing audit trail.
-- Making the deny explicit survives future role grants.

DROP POLICY IF EXISTS "connect_sessions_no_delete" ON connect_sessions;

CREATE POLICY "connect_sessions_no_delete"
  ON connect_sessions
  FOR DELETE
  USING (false);


-- ─── 5. connect_messages: explicit DELETE deny policy ─────────────────────────
--
-- No DELETE policy existed. Compound risk with connect_sessions cascade: a session
-- deletion would cascade-delete all messages, but even without that path, a user
-- deleting their own messages post-billing removes evidence of session content.
-- All message reads/writes go through service_role (BYPASSRLS) and are unaffected.

DROP POLICY IF EXISTS "connect_messages_no_delete" ON connect_messages;

CREATE POLICY "connect_messages_no_delete"
  ON connect_messages
  FOR DELETE
  USING (false);


-- ─── 6. connect_recharges: add amount_inr column ─────────────────────────────
--
-- The recharge create route converts totalAmount (consultant currency) to INR for
-- Razorpay, but only stored `amount` in consultant currency. The verify route then
-- used `amount * 100` as invoice amountPaise — correct for INR consultants but
-- ~83× wrong for USD consultants (e.g. USD 50 → 5,000 paise instead of 417,500).
-- Storing the pre-computed INR amount at create time ensures verify can produce an
-- accurate invoice regardless of exchange rate drift between create and verify.
--
-- Safe to run on existing rows: nullable column, existing rows get NULL (correct —
-- those recharges happened before this column existed and their invoices are already issued).

ALTER TABLE connect_recharges
  ADD COLUMN IF NOT EXISTS amount_inr NUMERIC(12,4);


-- ─── 7. connect_recharges: INR backfill for pre-v30 pending rows ──────────────
--
-- Pending recharges created before v30 have amount_inr IS NULL. The verify route
-- falls back to `amount` for these rows, which is correct for INR consultants
-- but wrong for non-INR consultants (e.g. amount=50 USD → 5,000 paise instead of
-- ~417,500 paise). This backfill fixes INR-only rows (where amount=amount_inr anyway).
-- Non-INR pending rows cannot be backfilled because the original exchange rate is
-- unknown; the verify route now logs a warning for those rows so they can be
-- manually identified and refunded if needed.
--
-- Safe to run on live traffic: scoped only to status='pending' rows with NULL amount_inr
-- where currency_code='INR' — for INR the conversion is 1:1.

UPDATE connect_recharges
   SET amount_inr = amount
 WHERE status = 'pending'
   AND amount_inr IS NULL
   AND currency_code = 'INR';


-- ─── 8. connect_recharges: explicit DELETE deny policy ────────────────────────
--
-- v30 added explicit INSERT and UPDATE deny policies. DELETE was left on implicit-deny.
-- A user who could delete their own pending recharge row could avoid having their
-- pending payment record stored (the Razorpay order would still exist, but the DB
-- would return 404 on verify). Making the deny explicit closes the same gap as items 2-3.

DROP POLICY IF EXISTS "connect_recharges_no_direct_delete" ON connect_recharges;

CREATE POLICY "connect_recharges_no_direct_delete"
  ON connect_recharges
  FOR DELETE
  USING (false);
