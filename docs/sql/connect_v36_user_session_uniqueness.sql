-- connect_v36_user_session_uniqueness.sql
-- Cycle-3 web audit finding. Run AFTER connect_v35_audit_trail.sql.
--
-- Problem: The sessions POST handler checks for duplicate active sessions via
-- SELECT maybeSingle() before INSERT, but two simultaneous requests can both
-- pass the check before either INSERT lands — creating two concurrent sessions
-- for the same user.
--
-- Fix: Partial unique index enforces the "one pending/active session per user"
-- invariant at the DB level. The server-side check becomes a fast-path that
-- returns a 409 before the INSERT (with a friendly existing_session_id); if
-- two requests race, the second INSERT gets a 23505 error which is caught and
-- returned as a 409.

CREATE UNIQUE INDEX IF NOT EXISTS uq_connect_sessions_user_active
  ON connect_sessions (user_id)
  WHERE status IN ('pending', 'active');


-- ─── Verify ───────────────────────────────────────────────────────────────────
-- SELECT indexname, indexdef FROM pg_indexes
--  WHERE tablename = 'connect_sessions' AND indexname = 'uq_connect_sessions_user_active';
-- -- Should return 1 row with WHERE status in ('pending','active')
