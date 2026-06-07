-- connect_v9_session_timezones.sql
-- Adds per-session timezone columns so the session page can display both
-- the user's clock and the consultant's clock simultaneously.
-- Run this in: Supabase SQL Editor → Execute

ALTER TABLE connect_sessions
  ADD COLUMN IF NOT EXISTS user_timezone       TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  ADD COLUMN IF NOT EXISTS consultant_timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata';

COMMENT ON COLUMN connect_sessions.user_timezone IS
  'IANA timezone of the user at session creation — captured from browser Intl API';
COMMENT ON COLUMN connect_sessions.consultant_timezone IS
  'IANA timezone of the consultant at session accept — captured from browser Intl API';
