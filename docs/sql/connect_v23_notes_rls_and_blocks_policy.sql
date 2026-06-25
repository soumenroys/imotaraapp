-- connect_v23_notes_rls_and_blocks_policy.sql
-- Fixes identified in Round-61 schema audit.
-- Run in Supabase SQL editor after connect_v22_grant_rpc_functions.sql.
--
-- Summary of changes:
-- 1. Fix connect_session_notes RLS: add WITH CHECK to prevent a consultant from
--    attaching notes to a session they were NOT the consultant for (direct-client bypass).
-- 2. Fix connect_sessions INSERT policy: add a connect_blocks guard so that a blocked
--    user cannot bypass the API layer and insert a session row directly via Supabase JS
--    client with their own JWT.

-- ─── 1. connect_session_notes — tighten INSERT/UPDATE policy ────────────────
--
-- Current policy: FOR ALL USING (consultant_user_id = auth.uid())
-- Problem: FOR ALL with only USING means the same expression is used as WITH CHECK
-- for INSERT. A consultant with a valid JWT can INSERT:
--   { session_id: <any_session_uuid>, consultant_user_id: auth.uid(), content: '...' }
-- The check passes because consultant_user_id = auth.uid() is trivially true —
-- there is no verification that session_id belongs to a session where auth.uid()
-- is the designated consultant.
--
-- Fix: Replace the FOR ALL policy with:
--   - A SELECT-only policy (USING: own rows only)
--   - An INSERT policy (WITH CHECK: own rows AND session's consultant is auth.uid())
--   - An UPDATE policy (same WITH CHECK guard)
--   - A DELETE policy (own rows only — consultants can delete their own notes)
--
-- Note: the API layer (/api/connect/sessions/[id]/notes/route.ts) already verifies
-- consultant ownership before any DB operation. This DB-level fix is defence-in-depth
-- to prevent direct Supabase client abuse.

DROP POLICY IF EXISTS "consultant manages own session notes" ON connect_session_notes;

-- SELECT: a consultant can only read notes where they are the author
CREATE POLICY "connect_session_notes_own_select"
  ON connect_session_notes
  FOR SELECT
  USING (consultant_user_id = auth.uid());

-- INSERT: consultant_user_id must be auth.uid() AND the session's consultant must also be auth.uid()
CREATE POLICY "connect_session_notes_own_insert"
  ON connect_session_notes
  FOR INSERT
  WITH CHECK (
    consultant_user_id = auth.uid()
    AND EXISTS (
      SELECT 1
        FROM connect_sessions   cs
        JOIN connect_consultants cc ON cc.id = cs.consultant_id
       WHERE cs.id   = session_id
         AND cc.user_id = auth.uid()
    )
  );

-- UPDATE: same guard — cannot move a note to a session the user did not consult on
CREATE POLICY "connect_session_notes_own_update"
  ON connect_session_notes
  FOR UPDATE
  USING (consultant_user_id = auth.uid())
  WITH CHECK (
    consultant_user_id = auth.uid()
    AND EXISTS (
      SELECT 1
        FROM connect_sessions   cs
        JOIN connect_consultants cc ON cc.id = cs.consultant_id
       WHERE cs.id   = session_id
         AND cc.user_id = auth.uid()
    )
  );

-- DELETE: a consultant can delete their own notes (no cross-session concern here)
CREATE POLICY "connect_session_notes_own_delete"
  ON connect_session_notes
  FOR DELETE
  USING (consultant_user_id = auth.uid());


-- ─── 2. connect_sessions INSERT — add block guard ────────────────────────────
--
-- Current policy: FOR INSERT WITH CHECK (auth.uid() = user_id)
-- Problem: a user who has been blocked by a consultant can bypass the API-layer
-- block check (sessions/route.ts:163–176) by calling Supabase JS client directly
-- with their own JWT. The INSERT policy only checks auth.uid() = user_id and
-- does not consult connect_blocks. The blocked user ends up with a 'pending'
-- session row that the consultant then has to manually decline.
--
-- Fix: replace the INSERT policy with one that also checks connect_blocks.
-- The correlated NOT EXISTS subquery runs on the already-indexed
-- (consultant_id, blocked_user_id) UNIQUE constraint, so cost is negligible.

DROP POLICY IF EXISTS "connect_sessions_user_insert" ON connect_sessions;

CREATE POLICY "connect_sessions_user_insert"
  ON connect_sessions
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND NOT EXISTS (
      SELECT 1
        FROM connect_blocks b
       WHERE b.consultant_id   = connect_sessions.consultant_id
         AND b.blocked_user_id = auth.uid()
    )
  );

-- Verify:
-- SELECT policyname, cmd, qual, with_check
--   FROM pg_policies
--  WHERE tablename = 'connect_session_notes';
--
-- SELECT policyname, cmd, with_check
--   FROM pg_policies
--  WHERE tablename = 'connect_sessions'
--    AND policyname = 'connect_sessions_user_insert';
