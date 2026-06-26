-- connect_v34_rls_rpc_hardening.sql
-- Cycle-1 DB audit findings. Run AFTER connect_v33_final_hardening.sql.
-- Apply each block individually in Supabase SQL editor.
--
-- Summary:
-- 1. decrement_pending_payout: add explicit balance guard (GREATEST(0,...) → RAISE EXCEPTION)
-- 2. connect_consultants_own_update: add is_busy to the WITH CHECK lock
-- 3. credit_imotara_wallet: add SET search_path = public (was missing, vuln to schema injection)
-- 4. connect_payouts admin SELECT policy: formalise admin read access
-- 5. connect_blocks: split FOR ALL → SELECT/INSERT/DELETE + UPDATE deny
-- 6. connect_favorites: split FOR ALL → SELECT/INSERT/DELETE + UPDATE deny
-- 7. connect_consultants: add explicit DELETE deny


-- ─── 1. decrement_pending_payout: add balance guard ──────────────────────────
--
-- Current implementation uses GREATEST(0, pending_payout - p_amount) which silently
-- clips to zero when p_amount > pending_payout. A payout of ₹500 against ₹100 balance
-- succeeds with no error or audit signal. Fix: SELECT FOR UPDATE + explicit RAISE.

CREATE OR REPLACE FUNCTION decrement_pending_payout(p_user_id UUID, p_amount NUMERIC)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current NUMERIC;
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'decrement_pending_payout: p_amount must be positive, got %', p_amount;
  END IF;

  SELECT pending_payout INTO v_current
    FROM connect_wallet
   WHERE user_id = p_user_id
   FOR UPDATE;

  IF v_current IS NULL THEN
    RAISE EXCEPTION 'decrement_pending_payout: wallet not found for user %', p_user_id;
  END IF;

  IF v_current < p_amount THEN
    RAISE EXCEPTION 'decrement_pending_payout: insufficient pending_payout (have %, need %)', v_current, p_amount;
  END IF;

  UPDATE connect_wallet
     SET pending_payout = pending_payout - p_amount,
         updated_at     = NOW()
   WHERE user_id = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION decrement_pending_payout(UUID, NUMERIC) TO service_role;


-- ─── 2. connect_consultants_own_update: lock is_busy ─────────────────────────
--
-- The previous WITH CHECK only prevented status changes. A consultant could set
-- is_busy=false via direct Supabase JS client while in an active session, defeating
-- the uq_connect_sessions_consultant_active unique index (v28). Lock is_busy to its
-- current DB value so only the service_role (API) can change it.

DROP POLICY IF EXISTS "connect_consultants_own_update" ON connect_consultants;

CREATE POLICY "connect_consultants_own_update"
  ON connect_consultants
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    -- status must not change — all transitions go through service_role API
    AND status = (SELECT cc.status FROM connect_consultants cc WHERE cc.user_id = auth.uid() LIMIT 1)
    -- is_busy must not change — set only by tick/accept/session routes via service_role
    AND is_busy = (SELECT cc.is_busy FROM connect_consultants cc WHERE cc.user_id = auth.uid() LIMIT 1)
  );


-- ─── 3. credit_imotara_wallet: add SET search_path ───────────────────────────
--
-- SECURITY DEFINER function without search_path pinning is vulnerable to schema
-- injection — a malicious search_path could redirect the INSERT/UPDATE to a shadow
-- table in a non-public schema.

CREATE OR REPLACE FUNCTION credit_imotara_wallet(
  p_user_id  UUID,
  p_amount   NUMERIC,
  p_currency TEXT DEFAULT 'INR'
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO imotara_wallets (user_id, balance, currency_code, updated_at)
  VALUES (p_user_id, p_amount, p_currency, now())
  ON CONFLICT (user_id) DO UPDATE
    SET balance    = imotara_wallets.balance + p_amount,
        updated_at = now();
$$;

GRANT EXECUTE ON FUNCTION credit_imotara_wallet(UUID, NUMERIC, TEXT) TO service_role;


-- ─── 4. connect_payouts admin SELECT ─────────────────────────────────────────
--
-- Admin payout panel uses getSupabaseAdmin() (BYPASSRLS) so it works without this,
-- but formalising the intent prevents a future regression if BYPASSRLS is ever
-- removed or the route switches to a user-scoped client.
-- Requires a super_admins table. If it doesn't exist yet, this is a no-op guard.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'super_admins') THEN

    DROP POLICY IF EXISTS "connect_payouts_admin_select" ON connect_payouts;

    EXECUTE $policy$
      CREATE POLICY "connect_payouts_admin_select"
        ON connect_payouts
        FOR SELECT
        USING (
          auth.uid() = consultant_user_id
          OR EXISTS (SELECT 1 FROM super_admins WHERE user_id = auth.uid())
        );
    $policy$;

  END IF;
END;
$$;


-- ─── 5. connect_blocks: split FOR ALL → explicit policies + UPDATE deny ───────

DROP POLICY IF EXISTS "consultant manages own blocks" ON connect_blocks;

CREATE POLICY "connect_blocks_consultant_select"
  ON connect_blocks FOR SELECT
  USING (consultant_id IN (
    SELECT id FROM connect_consultants WHERE user_id = auth.uid()
  ));

CREATE POLICY "connect_blocks_consultant_insert"
  ON connect_blocks FOR INSERT
  WITH CHECK (consultant_id IN (
    SELECT id FROM connect_consultants WHERE user_id = auth.uid()
  ));

CREATE POLICY "connect_blocks_consultant_delete"
  ON connect_blocks FOR DELETE
  USING (consultant_id IN (
    SELECT id FROM connect_consultants WHERE user_id = auth.uid()
  ));

CREATE POLICY "connect_blocks_no_direct_update"
  ON connect_blocks FOR UPDATE
  USING (false);


-- ─── 6. connect_favorites: split FOR ALL → explicit policies + UPDATE deny ────

DROP POLICY IF EXISTS "user manages own favorites" ON connect_favorites;

CREATE POLICY "connect_favorites_user_select"
  ON connect_favorites FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "connect_favorites_user_insert"
  ON connect_favorites FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "connect_favorites_user_delete"
  ON connect_favorites FOR DELETE
  USING (user_id = auth.uid());

CREATE POLICY "connect_favorites_no_update"
  ON connect_favorites FOR UPDATE
  USING (false);


-- ─── 7. connect_consultants: explicit DELETE deny ─────────────────────────────
--
-- v33 added INSERT deny. Matching DELETE deny for symmetry — prevents accidental
-- self-deletion if the authenticated role ever receives a future GRANT.

DROP POLICY IF EXISTS "connect_consultants_no_direct_delete" ON connect_consultants;

CREATE POLICY "connect_consultants_no_direct_delete"
  ON connect_consultants
  FOR DELETE
  USING (false);


-- ─── Verify ───────────────────────────────────────────────────────────────────
-- SELECT prosrc FROM pg_proc WHERE proname = 'decrement_pending_payout';
-- -- Should contain RAISE EXCEPTION (not GREATEST)
--
-- SELECT policyname, cmd, qual, with_check
--   FROM pg_policies
--  WHERE tablename = 'connect_consultants'
--    AND policyname IN ('connect_consultants_own_update',
--                       'connect_consultants_no_direct_delete');
--
-- SELECT policyname FROM pg_policies WHERE tablename = 'connect_blocks';
-- -- Should show 4 policies, no "consultant manages own blocks"
--
-- SELECT policyname FROM pg_policies WHERE tablename = 'connect_favorites';
-- -- Should show 4 policies, no "user manages own favorites"
