-- connect_v3_consultant_docs.sql
-- Adds document verification and payout info columns to connect_consultants.
-- Run in Supabase SQL editor AFTER connect_v2_features.sql.

ALTER TABLE connect_consultants
  ADD COLUMN IF NOT EXISTS verification_docs JSONB,
  ADD COLUMN IF NOT EXISTS payout_info        JSONB,
  ADD COLUMN IF NOT EXISTS docs_verified      BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS docs_notes         TEXT;

-- Index for admin queries filtering on verification status
CREATE INDEX IF NOT EXISTS idx_connect_consultants_docs_verified
  ON connect_consultants(docs_verified) WHERE status = 'pending';
