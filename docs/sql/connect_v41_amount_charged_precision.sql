-- connect_v41_amount_charged_precision.sql
-- P1-4 (code_review_audit_2026_08_14): amount_charged was NUMERIC(12,2) while
-- platform_fee/consultant_credited are NUMERIC(12,4) — a real precision
-- mismatch (e.g. platform_fee=21.9978 + consultant_credited=87.9912 = 109.989,
-- but amount_charged stored 109.99, off by 0.001) that made per-session
-- reconciliation (amount_charged = platform_fee + consultant_credited) fail
-- by construction, not just float noise. Widen to match.
--
-- amount_charged is referenced in the connect_sessions_participant_update RLS
-- policy's WITH CHECK clause (locked there since connect_v29, extended in
-- connect_v39) — Postgres refuses ALTER COLUMN TYPE while a policy expression
-- depends on the column ("cannot alter type of a column used in a policy
-- definition"). Drop the policy, widen the column, recreate the policy with
-- the EXACT same definition as connect_v39_lock_translation_columns.sql (the
-- latest version — confirmed no later migration redefines it). Policy
-- expressions don't reference column type, so recreating it verbatim is safe.

DROP POLICY IF EXISTS "connect_sessions_participant_update" ON connect_sessions;

ALTER TABLE connect_sessions ALTER COLUMN amount_charged TYPE NUMERIC(12,4);

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
    -- Rating columns: only allow changes when the session is already completed.
    -- Prevents a user from rating a pending or active session via direct client call,
    -- which would corrupt the rating_avg trigger aggregate.
    AND (
      rating IS NOT DISTINCT FROM
        (SELECT cs.rating FROM connect_sessions cs WHERE cs.id = connect_sessions.id)
      OR (SELECT cs.status FROM connect_sessions cs WHERE cs.id = connect_sessions.id) = 'completed'
    )
    -- Translation state: written only by the service-role toggle_translation
    -- PATCH action, never directly by a participant client.
    AND translation_enabled IS NOT DISTINCT FROM
        (SELECT cs.translation_enabled FROM connect_sessions cs WHERE cs.id = connect_sessions.id)
    AND rate_per_min IS NOT DISTINCT FROM
        (SELECT cs.rate_per_min FROM connect_sessions cs WHERE cs.id = connect_sessions.id)
    AND user_lang IS NOT DISTINCT FROM
        (SELECT cs.user_lang FROM connect_sessions cs WHERE cs.id = connect_sessions.id)
    AND consultant_lang IS NOT DISTINCT FROM
        (SELECT cs.consultant_lang FROM connect_sessions cs WHERE cs.id = connect_sessions.id)
  );

-- Verification (run manually after applying):
--   SELECT data_type, numeric_precision, numeric_scale FROM information_schema.columns
--   WHERE table_name = 'connect_sessions' AND column_name = 'amount_charged';
--   -- Expect: numeric, 12, 4
--
--   SELECT polname, pg_get_expr(polwithcheck, polrelid)
--   FROM pg_policy WHERE polname = 'connect_sessions_participant_update';
--   -- Confirm the expression still includes all locked columns (status, amount_charged,
--   -- platform_fee, consultant_credited, rating, translation_enabled, rate_per_min,
--   -- user_lang, consultant_lang) — should be byte-identical to before this migration.
