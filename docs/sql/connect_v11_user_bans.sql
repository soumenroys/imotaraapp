-- connect_v11_user_bans.sql
-- True user ban system: blocks access at API level, not just license withdrawal.
-- Run in Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS user_bans (
  user_id     uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  banned_by   text        NOT NULL,          -- admin email
  reason      text        NOT NULL,
  banned_at   timestamptz NOT NULL DEFAULT now(),
  unbanned_at timestamptz
);

ALTER TABLE user_bans ENABLE ROW LEVEL SECURITY;

-- Only service role can read/write (admin panel uses service key)
CREATE POLICY "service_only_bans" ON user_bans
  FOR ALL USING (false);

CREATE INDEX IF NOT EXISTS idx_user_bans_active ON user_bans (user_id)
  WHERE unbanned_at IS NULL;
