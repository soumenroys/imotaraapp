-- crisis_events_v1.sql
-- Metadata-only crisis-detection log, dashboard visibility for admins.
-- Deliberately does NOT store message text (owner decision 2026-08-14) —
-- only enough to identify who and when, minimizing stored sensitive data.
-- Run in Supabase SQL Editor with the service-role connection.

CREATE TABLE IF NOT EXISTS crisis_events (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid        REFERENCES auth.users(id) ON DELETE CASCADE,
  platform       text        NOT NULL CHECK (platform IN ('web', 'mobile')),
  preferred_lang text,
  created_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE crisis_events ENABLE ROW LEVEL SECURITY;

-- Only the service role (used server-side by chat-reply and the admin API)
-- can read/write — no user, including the flagged user themselves, can ever
-- query this table directly via the anon/authenticated client keys.
CREATE POLICY "service_only_crisis_events" ON crisis_events
  FOR ALL USING (false);

-- Supports both the write-time dedup lookup (one row per ~60min episode,
-- not one per crisis-adjacent message turn) and the admin dashboard's
-- default chronological listing.
CREATE INDEX IF NOT EXISTS idx_crisis_events_user_recent
  ON crisis_events (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_crisis_events_created_at
  ON crisis_events (created_at DESC);
