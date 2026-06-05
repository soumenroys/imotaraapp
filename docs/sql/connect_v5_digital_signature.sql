-- connect_v5_digital_signature.sql
-- Adds digital signature column to connect_consultants.
-- Run AFTER connect_v4_contact_info.sql.

ALTER TABLE connect_consultants
  ADD COLUMN IF NOT EXISTS digital_signature TEXT;
