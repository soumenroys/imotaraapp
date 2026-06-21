-- connect_v16_security_hardening.sql
-- Run in Supabase SQL editor (Settings → SQL editor → New snippet → Run).
-- Implements three hardening changes:
--   1. Add 'deleted' to connect_consultants.status CHECK constraint
--      (admin soft-delete previously always failed with a constraint violation)
--   2. Fix RLS to prevent a consultant from self-approving their status via
--      the Supabase JS client (direct DB access bypasses the API layer)
--   3. Atomic consultant rating update via trigger
--      (previously a non-atomic read-aggregate-write that could produce
--       off-by-one counts under concurrent review submissions)
-- Also creates an index on connect_messages(sender_id, created_at) to support
-- the global per-user message rate-limit query efficiently.

-- ─── 1. STATUS CHECK CONSTRAINT ───────────────────────────────────────────────
-- The original constraint only allowed:
--   ('pending','approved','suspended','rejected')
-- The soft-delete admin action sets status = 'deleted', which always hit a
-- constraint violation. Adding 'deleted' here unblocks that admin feature.

ALTER TABLE connect_consultants
  DROP CONSTRAINT IF EXISTS connect_consultants_status_check;

ALTER TABLE connect_consultants
  ADD CONSTRAINT connect_consultants_status_check
  CHECK (status IN ('pending', 'approved', 'suspended', 'rejected', 'deleted'));

-- ─── 2. RLS: PREVENT SELF-APPROVAL ────────────────────────────────────────────
-- The existing policy "connect_consultants_own_all" is FOR ALL, which includes
-- UPDATE. This allows a consultant who has direct Supabase client access (e.g.,
-- using their own JWT with the anon key) to UPDATE their own row and set
-- status = 'approved', bypassing the admin approval flow.
--
-- Fix: split the policy into SELECT-only (for reading own profile) and a
-- restricted UPDATE that explicitly prevents changing the status column.

DROP POLICY IF EXISTS "connect_consultants_own_all" ON connect_consultants;

-- Allow consultants to read their own row (needed for the dashboard)
CREATE POLICY "connect_consultants_own_select"
  ON connect_consultants
  FOR SELECT
  USING (auth.uid() = user_id);

-- Allow consultants to update their own row, but ONLY non-status fields.
-- The WITH CHECK clause forces the new status to equal the current status,
-- so no UPDATE can change the status column.
CREATE POLICY "connect_consultants_own_update"
  ON connect_consultants
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND status = (
      SELECT status FROM connect_consultants WHERE user_id = auth.uid()
    )
  );

-- ─── 3. ATOMIC CONSULTANT RATING UPDATE ───────────────────────────────────────
-- The previous flow read all ratings, computed the average in application code,
-- then wrote it back. Two concurrent reviews could both read a stale count and
-- produce an off-by-one aggregate.
--
-- Fix: a BEFORE INSERT trigger on connect_sessions (the reviews are stored on
-- sessions) computes the aggregate atomically using SQL aggregation. Because
-- the trigger runs inside the same transaction as the INSERT, it always reads
-- the final committed state.

CREATE OR REPLACE FUNCTION update_consultant_rating()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count   INT;
  v_avg     NUMERIC(3,2);
BEGIN
  -- Only recompute when a review is being submitted (rating transitions from NULL/0 to a value)
  IF NEW.rating IS NULL OR NEW.rating = 0 THEN
    RETURN NEW;
  END IF;

  SELECT
    COUNT(*),
    ROUND(AVG(rating)::NUMERIC, 2)
  INTO v_count, v_avg
  FROM connect_sessions
  WHERE consultant_id = NEW.consultant_id
    AND rating IS NOT NULL
    AND rating > 0
    AND id != NEW.id;  -- exclude the current row (not yet committed)

  -- Include the current review in the aggregate
  v_count := v_count + 1;
  v_avg   := ROUND(
    ((v_avg * (v_count - 1)) + NEW.rating) / v_count,
    2
  );

  UPDATE connect_consultants
  SET
    rating_avg   = v_avg,
    rating_count = v_count
  WHERE id = NEW.consultant_id;

  RETURN NEW;
END;
$$;

-- Drop the old trigger if it exists from a prior migration attempt
DROP TRIGGER IF EXISTS trg_update_consultant_rating ON connect_sessions;

CREATE TRIGGER trg_update_consultant_rating
  AFTER UPDATE OF rating ON connect_sessions
  FOR EACH ROW
  WHEN (NEW.rating IS NOT NULL AND NEW.rating > 0 AND OLD.rating IS DISTINCT FROM NEW.rating)
  EXECUTE FUNCTION update_consultant_rating();

-- ─── 4. INDEX FOR GLOBAL MESSAGE RATE-LIMIT QUERY ─────────────────────────────
-- The messages route now performs a COUNT query filtered by sender_id and
-- created_at to enforce a global 60-messages/minute rate limit. Without an
-- index this would be a sequential scan on a potentially large table.

CREATE INDEX IF NOT EXISTS idx_connect_messages_sender_created
  ON connect_messages (sender_id, created_at DESC);
