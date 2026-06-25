-- connect_v29_rls_schema_hardening.sql
-- DB integrity and security gaps identified in Round-78 audit.
-- Run in Supabase SQL editor AFTER connect_v28_integrity_constraints.sql.
-- Apply statements one at a time (Supabase SQL editor does not wrap in a transaction).
--
-- Summary:
-- 1. DROP DEFAULT 0 from connect_sessions.rate_per_min — DEFAULT now conflicts with
--    the CHECK (rate_per_min > 0) added in v28.
-- 2. RLS UPDATE policy WITH CHECK on connect_sessions — prevents direct-client writes
--    to status, amount_charged, platform_fee, consultant_credited.
-- 3. Partial UNIQUE index on connect_recharges.stripe_payment_id — mirrors the
--    razorpay_payment_id index from v28 for the Stripe payment path.
-- 4. completed_at column on connect_recharges — payment completion timestamp for
--    audit trail and GDPR retention calculations.
-- 5. Partial UNIQUE index on connect_sessions(consultant_id, scheduled_at) — DB-level
--    guard against exact-duplicate scheduled-time double-booking.
-- 6. update_consultant_rating() — rewritten to use a locking UPDATE instead of
--    SELECT + UPDATE two-step, eliminating the MVCC concurrent-review race.
-- 7. increment_wallet_earnings() — add p_amount > 0 guard to prevent silent subtraction.
-- 8. connect_payouts.updated_at column + trigger — timestamps all status transitions.


-- ─── 1. rate_per_min: drop DEFAULT 0 (conflicts with CHECK > 0 from v28) ─────
--
-- Any INSERT that omits rate_per_min would use DEFAULT 0, which immediately violates
-- the v28 CHECK (rate_per_min > 0), producing an opaque 23514 error that doesn't
-- point to the DEFAULT as the cause. Dropping the DEFAULT makes the error explicit:
-- a NOT NULL or a missing-value error rather than a CHECK violation.
-- The application always supplies rate_per_min; this change is a backstop.

ALTER TABLE connect_sessions
  ALTER COLUMN rate_per_min DROP DEFAULT;


-- ─── 2. RLS UPDATE policy WITH CHECK on connect_sessions ─────────────────────
--
-- The existing UPDATE policy has a USING clause (controls which rows are visible to
-- UPDATE) but no WITH CHECK clause (controls which new values are permitted). Without
-- WITH CHECK, an authenticated user can call supabase.from("connect_sessions").update()
-- with their own JWT and set status="completed", amount_charged=0, rating=5, etc. —
-- bypassing the API layer entirely. The service_role client (used by all API routes)
-- bypasses RLS (BYPASSRLS is set for service_role), so this change does not affect
-- the API routes.
--
-- The WITH CHECK locks four financial/state columns to their pre-update values:
--   status           — transitions must go through the service-role API (PATCH action)
--   amount_charged   — billing amounts written only by tick route and orphan cron
--   platform_fee     — fee split written only by tick/orphan/PATCH complete paths
--   consultant_credited — credit written only by tick/orphan/PATCH complete paths
--
-- rating, review_text, and review_submitted_at are intentionally NOT locked here
-- because the review submission flow needs to be handled by a dedicated policy change
-- or a WITH CHECK that allows updates only when status='completed'.

DROP POLICY IF EXISTS "connect_sessions_participant_update" ON connect_sessions;

CREATE POLICY "connect_sessions_participant_update"
  ON connect_sessions
  FOR UPDATE
  USING (
    auth.uid() = user_id OR
    auth.uid() IN (
      SELECT user_id FROM connect_consultants WHERE id = consultant_id
    )
  )
  WITH CHECK (
    -- Caller must still be a participant (same as USING)
    (
      auth.uid() = user_id OR
      auth.uid() IN (
        SELECT user_id FROM connect_consultants WHERE id = consultant_id
      )
    )
    -- status must not change — all transitions go through the service-role API
    AND status = (SELECT cs.status FROM connect_sessions cs WHERE cs.id = connect_sessions.id)
    -- Financial columns are write-protected from direct client access
    AND amount_charged IS NOT DISTINCT FROM
        (SELECT cs.amount_charged FROM connect_sessions cs WHERE cs.id = connect_sessions.id)
    AND platform_fee IS NOT DISTINCT FROM
        (SELECT cs.platform_fee FROM connect_sessions cs WHERE cs.id = connect_sessions.id)
    AND consultant_credited IS NOT DISTINCT FROM
        (SELECT cs.consultant_credited FROM connect_sessions cs WHERE cs.id = connect_sessions.id)
  );


-- ─── 3. stripe_payment_id: unique where not null ──────────────────────────────
--
-- Mirrors the razorpay_payment_id index added in v28. Without this, a Stripe webhook
-- retry on timeout would find status='pending' and double-credit the user's minutes.
-- Partial index: NULL values (non-Stripe recharges) do not conflict.

CREATE UNIQUE INDEX IF NOT EXISTS uq_connect_recharges_stripe_payment_id
  ON connect_recharges (stripe_payment_id)
  WHERE stripe_payment_id IS NOT NULL;


-- ─── 4. connect_recharges.completed_at ───────────────────────────────────────
--
-- Provides a DB-level timestamp for when a recharge transitioned from pending to
-- completed (or refunded). Required for GDPR data retention calculations and payment
-- dispute forensics. Currently the payment_invoices.issued_at serves as a proxy but
-- is created in a separate non-atomic step after the UPDATE.
-- Application fix also required: add completed_at: new Date().toISOString() to the
-- UPDATE payload in wallet/recharge/verify/route.ts (already applied in round-78).

ALTER TABLE connect_recharges
  ADD COLUMN IF NOT EXISTS completed_at timestamptz;


-- ─── 5. Scheduled session overlap: partial unique index on exact scheduled_at ─
--
-- The application-level double-booking check in sessions/route.ts has a TOCTOU window:
-- two concurrent POST requests can both pass the hasConflict check before either INSERT
-- completes. This partial unique index prevents exact-time duplicates at the DB level.
-- Full interval-overlap prevention requires btree_gist EXCLUDE (see comment below);
-- this index addresses the most common case (same consultant, same time, same day).
--
-- For full interval overlap protection (future migration):
--   CREATE EXTENSION IF NOT EXISTS btree_gist;
--   ALTER TABLE connect_sessions ADD CONSTRAINT no_overlapping_scheduled
--     EXCLUDE USING gist (
--       consultant_id WITH =,
--       tstzrange(scheduled_at,
--                 scheduled_at + (COALESCE(scheduled_duration_min,60) * interval '1 minute'))
--       WITH &&
--     )
--     WHERE (status IN ('pending','active') AND type = 'scheduled');

CREATE UNIQUE INDEX IF NOT EXISTS uq_connect_sessions_consultant_scheduled_at
  ON connect_sessions (consultant_id, scheduled_at)
  WHERE status IN ('pending', 'active')
    AND type = 'scheduled'
    AND scheduled_at IS NOT NULL;


-- ─── 6. update_consultant_rating(): eliminate MVCC concurrent-review race ─────
--
-- The original function used SELECT COUNT(*)/AVG(rating) + a separate UPDATE.
-- Under MVCC, two concurrent review submissions each see a snapshot that excludes
-- the other's uncommitted row. Both compute rating_count=1 (instead of 2) and
-- overwrite — one review is silently dropped from the aggregate.
--
-- The fix: the UPDATE statement acquires a ROW EXCLUSIVE lock on the consultant row.
-- Any concurrent trigger that tries to UPDATE the same row waits for the lock.
-- The aggregate SELECT inside the UPDATE sees all committed rows at lock time,
-- including any review that committed before this lock was granted.

CREATE OR REPLACE FUNCTION update_consultant_rating()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.rating IS NULL OR NEW.rating = 0 THEN
    RETURN NEW;
  END IF;

  UPDATE connect_consultants
  SET
    rating_count = (
      SELECT COUNT(*)::integer
        FROM connect_sessions
       WHERE consultant_id = NEW.consultant_id
         AND rating IS NOT NULL AND rating > 0
    ),
    rating_avg = ROUND(GREATEST(0, (
      SELECT AVG(rating)::NUMERIC
        FROM connect_sessions
       WHERE consultant_id = NEW.consultant_id
         AND rating IS NOT NULL AND rating > 0
    )), 2)
  WHERE id = NEW.consultant_id;

  RETURN NEW;
END;
$$;

GRANT EXECUTE ON FUNCTION update_consultant_rating() TO service_role;


-- ─── 7. increment_wallet_earnings(): guard against zero/negative p_amount ─────
--
-- The function currently accepts any NUMERIC value. A future admin tool or payout-
-- reversal code path that passes a negative p_amount would silently subtract from
-- earned_amount (bounded by the connect_wallet_earned_nonneg CHECK from v27 at 0,
-- but the subtraction itself would succeed up to that point with no error).
-- Adding an explicit guard surfaces the bug at the call site immediately.

CREATE OR REPLACE FUNCTION increment_wallet_earnings(p_user_id UUID, p_amount NUMERIC)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'increment_wallet_earnings: p_amount must be positive, got %', p_amount;
  END IF;
  UPDATE connect_wallet
  SET earned_amount = earned_amount + p_amount,
      updated_at    = NOW()
  WHERE user_id = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION increment_wallet_earnings(UUID, NUMERIC) TO service_role;


-- ─── 8. connect_payouts.updated_at column + auto-update trigger ──────────────
--
-- connect_payouts has created_at and processed_at (only set on status='completed')
-- but no updated_at. Status transitions to 'processing' and 'failed' leave no
-- DB-level timestamp. GDPR audit (gdpr_audit_2026_06.md) flags missing audit
-- trails as a medium finding.

ALTER TABLE connect_payouts
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE OR REPLACE FUNCTION _set_connect_payouts_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_connect_payouts_updated_at ON connect_payouts;
CREATE TRIGGER trg_connect_payouts_updated_at
  BEFORE UPDATE ON connect_payouts
  FOR EACH ROW EXECUTE FUNCTION _set_connect_payouts_updated_at();


-- ─── Verify ──────────────────────────────────────────────────────────────────
-- SELECT column_default FROM information_schema.columns
--   WHERE table_name='connect_sessions' AND column_name='rate_per_min';
-- -- Should return NULL (no default)
--
-- SELECT indexname FROM pg_indexes
--   WHERE tablename='connect_recharges'
--     AND indexname IN ('uq_connect_recharges_stripe_payment_id');
--
-- SELECT column_name FROM information_schema.columns
--   WHERE table_name='connect_recharges' AND column_name='completed_at';
--
-- SELECT column_name FROM information_schema.columns
--   WHERE table_name='connect_payouts' AND column_name='updated_at';
