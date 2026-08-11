-- connect_v39_lock_translation_columns.sql
--
-- Defense-in-depth companion to the mid-session auto-translation toggle feature
-- (PATCH action "toggle_translation" on /api/connect/sessions/[id]).
--
-- Not required for the feature to work: the toggle route uses the service-role
-- client, which bypasses RLS entirely (BYPASSRLS is set for service_role), same
-- as every other mutation in that route. This migration closes a latent gap
-- instead — now that translation_enabled/rate_per_min/user_lang/consultant_lang
-- are app-facing toggleable state (not just booking-time-only fields), a
-- reverse-engineered client with a valid participant JWT could otherwise call
-- supabase.from("connect_sessions").update() directly and set an arbitrary
-- rate_per_min (only guarded today by the blanket CHECK (rate_per_min > 0),
-- which still permits e.g. 0.01) or flip translation_enabled/user_lang/
-- consultant_lang with no toggle-route validation at all.
--
-- Extends the connect_sessions_participant_update WITH CHECK policy from
-- connect_v29_rls_schema_hardening.sql (still the current version — confirmed
-- no later migration re-creates this policy) to also lock these four columns
-- to their pre-update values, matching the existing pattern used there for
-- status/amount_charged/platform_fee/consultant_credited.

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
--   SELECT polname, pg_get_expr(polwithcheck, polrelid)
--   FROM pg_policy WHERE polname = 'connect_sessions_participant_update';
-- Confirm the expression includes translation_enabled/rate_per_min/user_lang/consultant_lang.
