-- connect_v43_fix_participant_update_recursion.sql
--
-- Fixes a latent (pre-existing, never exercised in production — confirmed via a
-- full repo search that no client-side code anywhere calls .update() directly on
-- connect_sessions) defect discovered while verifying connect_v41: the
-- connect_sessions_participant_update policy's WITH CHECK clause (unchanged since
-- connect_v29, extended in connect_v39) locks 9 columns to their pre-update values
-- using self-referencing correlated subqueries, e.g.:
--   amount_charged IS NOT DISTINCT FROM
--     (SELECT cs.amount_charged FROM connect_sessions cs WHERE cs.id = connect_sessions.id)
-- This is a known Postgres RLS trap: evaluating that subquery re-applies RLS to
-- connect_sessions from within the UPDATE's own WITH CHECK evaluation, which trips
-- Postgres's recursion guard ("infinite recursion detected in policy for relation
-- connect_sessions", error 42P17) instead of cleanly rejecting the write.
--
-- Fix: move the "these columns must not change" enforcement out of RLS entirely
-- and into a BEFORE UPDATE trigger, which receives OLD and NEW as plain in-memory
-- row images — no subquery, no re-entrant RLS evaluation, no recursion possible
-- by construction. The RLS policy itself goes back to simple participant-membership
-- checks (matching the pre-v29 shape), with the trigger doing all the column-lock
-- enforcement that v29/v39 added.
--
-- IMPORTANT — service_role must still bypass this: RLS policies are automatically
-- skipped for roles with BYPASSRLS (service_role — every API route's admin client),
-- but triggers are NOT automatically skipped for BYPASSRLS roles; they always fire.
-- Without an explicit bypass check, this trigger would block every legitimate
-- service-role write to these columns (tick route, cron, etc.) — the opposite of
-- what v29/v39 intended. The trigger checks pg_roles.rolbypassrls directly (a hard
-- database privilege, not a JWT claim) to mirror RLS's own bypass semantics exactly.

CREATE OR REPLACE FUNCTION connect_sessions_lock_protected_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Roles with BYPASSRLS (service_role) skip these checks entirely — RLS already
  -- lets them write these columns freely; this trigger must mirror that exactly,
  -- since triggers fire regardless of RLS bypass status.
  IF (SELECT rolbypassrls FROM pg_roles WHERE rolname = current_user) THEN
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'status can only be changed via the service-role API';
  END IF;
  IF NEW.amount_charged IS DISTINCT FROM OLD.amount_charged THEN
    RAISE EXCEPTION 'amount_charged can only be changed via the service-role API';
  END IF;
  IF NEW.platform_fee IS DISTINCT FROM OLD.platform_fee THEN
    RAISE EXCEPTION 'platform_fee can only be changed via the service-role API';
  END IF;
  IF NEW.consultant_credited IS DISTINCT FROM OLD.consultant_credited THEN
    RAISE EXCEPTION 'consultant_credited can only be changed via the service-role API';
  END IF;
  -- Rating columns: only allow changes once the session is already completed —
  -- prevents a user from rating a pending/active session via direct client call,
  -- which would corrupt the rating_avg trigger aggregate.
  IF NEW.rating IS DISTINCT FROM OLD.rating AND OLD.status <> 'completed' THEN
    RAISE EXCEPTION 'rating can only be set once the session is completed';
  END IF;
  -- Translation state: written only by the service-role toggle_translation PATCH
  -- action, never directly by a participant client.
  IF NEW.translation_enabled IS DISTINCT FROM OLD.translation_enabled THEN
    RAISE EXCEPTION 'translation_enabled can only be changed via the service-role API';
  END IF;
  IF NEW.rate_per_min IS DISTINCT FROM OLD.rate_per_min THEN
    RAISE EXCEPTION 'rate_per_min can only be changed via the service-role API';
  END IF;
  IF NEW.user_lang IS DISTINCT FROM OLD.user_lang THEN
    RAISE EXCEPTION 'user_lang can only be changed via the service-role API';
  END IF;
  IF NEW.consultant_lang IS DISTINCT FROM OLD.consultant_lang THEN
    RAISE EXCEPTION 'consultant_lang can only be changed via the service-role API';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_connect_sessions_lock_protected_columns ON connect_sessions;
CREATE TRIGGER trg_connect_sessions_lock_protected_columns
  BEFORE UPDATE ON connect_sessions
  FOR EACH ROW EXECUTE FUNCTION connect_sessions_lock_protected_columns();

-- Simplify the policy back to a pure participant-membership check — the trigger
-- above now owns all column-lock enforcement, so the self-referencing subqueries
-- (the actual source of the recursion) are removed entirely, not worked around.
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
    auth.uid() = user_id OR
    auth.uid() IN (
      SELECT user_id FROM connect_consultants WHERE id = consultant_id
    )
  );

-- Verification (run manually after applying):
--   SELECT polname, pg_get_expr(polwithcheck, polrelid)
--   FROM pg_policy WHERE polname = 'connect_sessions_participant_update';
--   -- Should be short — just the participant-membership OR, no self-referencing subqueries.
--
--   SELECT tgname FROM pg_trigger
--   WHERE tgrelid = 'connect_sessions'::regclass AND tgname = 'trg_connect_sessions_lock_protected_columns';
--   -- Should return one row.
