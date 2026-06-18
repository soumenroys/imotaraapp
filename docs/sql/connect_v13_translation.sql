-- connect_v13_translation.sql
-- Adds session-level opt-in translation support to Imotara Connect.
-- Run in Supabase SQL editor after connect_v12_user_profiles.sql.

-- 1. Counselor's preferred session language (set once in their profile)
ALTER TABLE connect_consultants
  ADD COLUMN IF NOT EXISTS preferred_lang TEXT NOT NULL DEFAULT 'en';

-- 2. Session-level translation state
ALTER TABLE connect_sessions
  ADD COLUMN IF NOT EXISTS translation_enabled   BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS user_lang             TEXT,          -- language user selected at booking
  ADD COLUMN IF NOT EXISTS consultant_lang       TEXT,          -- consultant's preferred_lang at booking time (snapshot)
  ADD COLUMN IF NOT EXISTS base_rate_per_min     NUMERIC(10,4); -- original rate before +10% translation surcharge

-- 3. Per-message translated content (NULL = no translation for this message)
ALTER TABLE connect_messages
  ADD COLUMN IF NOT EXISTS translated_content TEXT;

-- Verify
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'connect_consultants' AND column_name = 'preferred_lang';
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'connect_sessions' AND column_name IN ('translation_enabled','user_lang','consultant_lang','base_rate_per_min');
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'connect_messages' AND column_name = 'translated_content';
