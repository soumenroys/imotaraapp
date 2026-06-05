-- connect_v6_approval_note.sql
-- Adds approval_note column to connect_consultants.
-- Run AFTER connect_v5_digital_signature.sql.

ALTER TABLE connect_consultants
  ADD COLUMN IF NOT EXISTS approval_note TEXT;
