-- connect_v4_contact_info.sql
-- Adds contact info and social links columns to connect_consultants.
-- Run in Supabase SQL editor AFTER connect_v3_consultant_docs.sql.

ALTER TABLE connect_consultants
  ADD COLUMN IF NOT EXISTS contact_email TEXT,
  ADD COLUMN IF NOT EXISTS contact_phone TEXT,
  ADD COLUMN IF NOT EXISTS website_url   TEXT,
  ADD COLUMN IF NOT EXISTS social_links  JSONB;
