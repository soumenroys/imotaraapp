-- Atomic increment for connect_consultants.sessions_completed
-- Replaces the application-level read-modify-write (sessions_completed + 1)
-- which can lose increments when two sessions complete concurrently for the
-- same consultant.
--
-- Run this in the Supabase SQL editor before deploying the matching code update.

CREATE OR REPLACE FUNCTION increment_sessions_completed(p_consultant_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE connect_consultants
  SET sessions_completed = COALESCE(sessions_completed, 0) + 1
  WHERE id = p_consultant_id;
$$;
