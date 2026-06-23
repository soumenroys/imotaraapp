-- connect_v19_schema_fixes.sql
-- Fixes identified in Round-55 schema audit.
-- Run in Supabase SQL editor after connect_v18_wallet_balance_rpc.sql.
--
-- Summary of changes:
-- 1. Add platform_fee + consultant_credited columns to connect_sessions
--    (orphan cron was writing platform_fee to a ghost column; earnings route
--    was SELECTing both columns — both silently failed or returned PostgREST 400)
-- 2. Add expo_push_token column to connect_consultants
--    (consultant push notifications never delivered because column was missing)
-- 3. Fix update_consultant_rating() trigger: NULL arithmetic on first review
--    caused a NOT NULL constraint violation → first review always rolled back
-- 4. Fix increment_wallet_earnings(): add SECURITY DEFINER (consistent with
--    all other RPCs: decrement_pending_payout, decrement_wallet_balance, etc.)
-- 5. Add compound indexes for the three hottest query paths

-- ─── 1. connect_sessions: add missing columns ────────────────────────────────

ALTER TABLE connect_sessions
  ADD COLUMN IF NOT EXISTS platform_fee        NUMERIC(12,4),
  ADD COLUMN IF NOT EXISTS consultant_credited NUMERIC(12,4);

-- ─── 2. connect_consultants: add missing expo_push_token column ──────────────

ALTER TABLE connect_consultants
  ADD COLUMN IF NOT EXISTS expo_push_token TEXT;

-- ─── 3. Fix update_consultant_rating() — COALESCE prevents NULL arithmetic ──
--
-- Bug: when this is the first review for a consultant, the SELECT returns
-- COUNT=0, AVG=NULL. The formula ((NULL * 0) + rating) / 1 = NULL in SQL,
-- which then violates the NOT NULL constraint on connect_consultants.rating_avg,
-- rolling back the entire review transaction. Every first review failed silently.

CREATE OR REPLACE FUNCTION update_consultant_rating()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INT;
  v_avg   NUMERIC(3,2);
BEGIN
  IF NEW.rating IS NULL OR NEW.rating = 0 THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*), ROUND(AVG(rating)::NUMERIC, 2)
  INTO v_count, v_avg
  FROM connect_sessions
  WHERE consultant_id = NEW.consultant_id
    AND rating IS NOT NULL
    AND rating > 0
    AND id != NEW.id;

  v_count := v_count + 1;
  -- COALESCE(v_avg, 0): when there are no prior reviews, AVG returns NULL;
  -- without this, ((NULL * 0) + NEW.rating) / 1 = NULL in SQL, violating NOT NULL.
  v_avg   := ROUND((COALESCE(v_avg, 0) * (v_count - 1) + NEW.rating) / v_count, 2);

  UPDATE connect_consultants
  SET rating_avg   = v_avg,
      rating_count = v_count,
      updated_at   = NOW()
  WHERE id = NEW.consultant_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_consultant_rating ON connect_sessions;
CREATE TRIGGER trg_update_consultant_rating
  AFTER UPDATE OF rating ON connect_sessions
  FOR EACH ROW
  WHEN (NEW.rating IS NOT NULL AND NEW.rating > 0 AND OLD.rating IS DISTINCT FROM NEW.rating)
  EXECUTE FUNCTION update_consultant_rating();

-- ─── 4. Fix increment_wallet_earnings() — add SECURITY DEFINER ───────────────
--
-- Without SECURITY DEFINER, the function runs as the invoking role. All other
-- RPCs in this codebase use SECURITY DEFINER. Inconsistency is a deployment
-- risk if the call site ever moves away from the service-role client.

CREATE OR REPLACE FUNCTION increment_wallet_earnings(p_user_id UUID, p_amount NUMERIC)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE connect_wallet
  SET earned_amount = earned_amount + p_amount,
      updated_at    = NOW()
  WHERE user_id = p_user_id;
END;
$$;

-- ─── 5. Compound indexes for hot query paths ─────────────────────────────────

-- Session list: WHERE user_id = X AND status IN ('pending','active')
CREATE INDEX IF NOT EXISTS idx_connect_sessions_user_status
  ON connect_sessions (user_id, status);

-- Tick + orphan cron: WHERE consultant_id = X AND status = 'active'
CREATE INDEX IF NOT EXISTS idx_connect_sessions_consultant_status
  ON connect_sessions (consultant_id, status);

-- get_session_balance RPC (every tick): WHERE user_id = X AND consultant_id = Y AND status = 'completed'
CREATE INDEX IF NOT EXISTS idx_connect_recharges_user_consultant_status
  ON connect_recharges (user_id, consultant_id, status);

-- Verify:
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'connect_sessions' AND column_name IN ('platform_fee','consultant_credited');
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'connect_consultants' AND column_name = 'expo_push_token';
-- SELECT proname, prosecdef FROM pg_proc WHERE proname IN ('update_consultant_rating','increment_wallet_earnings');
-- SELECT indexname FROM pg_indexes WHERE tablename IN ('connect_sessions','connect_recharges') AND indexname LIKE 'idx_connect_%status%';
