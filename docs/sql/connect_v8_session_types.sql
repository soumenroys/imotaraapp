-- connect_v8_session_types.sql
-- Adds session_types column to connect_consultants.
-- Counsellors choose which modalities they offer: chat, audio, video.
-- Run once in Supabase SQL Editor.

ALTER TABLE connect_consultants
  ADD COLUMN IF NOT EXISTS session_types text[] NOT NULL DEFAULT ARRAY['chat'];

-- Backfill any existing rows to ensure they have at least 'chat'
UPDATE connect_consultants
   SET session_types = ARRAY['chat']
 WHERE session_types IS NULL OR array_length(session_types, 1) IS NULL;
