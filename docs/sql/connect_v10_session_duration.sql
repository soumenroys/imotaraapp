-- connect_v10_session_duration.sql
-- Adds scheduled_duration_min to connect_sessions so the intended duration
-- for a scheduled session is stored server-side (used for cost estimates,
-- consultant dashboard display, and orphan recovery timeout).
-- Run in: Supabase SQL Editor → Execute

ALTER TABLE connect_sessions
  ADD COLUMN IF NOT EXISTS scheduled_duration_min INTEGER;

COMMENT ON COLUMN connect_sessions.scheduled_duration_min IS
  'Intended duration (minutes) for scheduled sessions — set by user at booking, null for instant sessions';
