-- connect_v12_user_profiles.sql
-- Multi-profile support for Family/Enterprise plans (MULTI_PROFILE feature gate).
-- Each user can have up to 6 named sub-profiles sharing their account.
-- Run in Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS user_profiles (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        text        NOT NULL,
  avatar_emoji text       NOT NULL DEFAULT '😊',
  age_range   text        CHECK (age_range IN ('child','teen','adult','senior')),
  gender      text        CHECK (gender IN ('male','female','other','prefer_not')),
  is_default  boolean     NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, name)
);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_profiles" ON user_profiles
  FOR ALL USING (auth.uid() = user_id);

-- Ensure only one default profile per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_profiles_default
  ON user_profiles (user_id)
  WHERE is_default = true;

CREATE INDEX IF NOT EXISTS idx_user_profiles_user ON user_profiles (user_id);
