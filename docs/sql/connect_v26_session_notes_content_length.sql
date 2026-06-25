-- connect_v26_session_notes_content_length.sql
-- Fixes identified in Round-66 schema audit.
-- Run in Supabase SQL editor after connect_v25_recharges_refunded_status.sql.
--
-- Summary of changes:
-- 1. Add DB-level CHECK constraint on connect_session_notes.content (max 2000 chars).
--    The column was created as plain TEXT with no length limit in connect_v2_features.sql.
--    The API route (sessions/[id]/notes/route.ts:58) enforces the same 2000-char limit,
--    but there is no DB backstop. A service-role direct write (admin tool, script, or
--    a new write path that forgets the guard) could store an arbitrarily large note,
--    degrading reporting queries and increasing response payload size on every fetch.
--    connect_messages.content already has this CHECK in the base schema; this migration
--    brings connect_session_notes in line.

ALTER TABLE connect_session_notes
  ADD CONSTRAINT connect_session_notes_content_length_check
  CHECK (char_length(content) <= 2000);

-- Verify:
-- SELECT conname, pg_get_constraintdef(oid)
--   FROM pg_constraint
--  WHERE conrelid = 'connect_session_notes'::regclass
--    AND conname = 'connect_session_notes_content_length_check';
-- Expected: CHECK ((char_length(content) <= 2000))
