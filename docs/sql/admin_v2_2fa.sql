-- admin_v2_2fa.sql
-- Adds TOTP-based 2FA to the super_admins table.
-- Run in Supabase SQL Editor.

ALTER TABLE super_admins
  ADD COLUMN IF NOT EXISTS totp_secret      text,
  ADD COLUMN IF NOT EXISTS totp_enabled     boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS totp_backup_codes text[];

COMMENT ON COLUMN super_admins.totp_secret IS
  'Base32-encoded TOTP secret (encrypted at rest by Postgres if TDE enabled)';
COMMENT ON COLUMN super_admins.totp_enabled IS
  'True when admin has completed 2FA enrollment';
COMMENT ON COLUMN super_admins.totp_backup_codes IS
  'Array of one-time backup codes (hashed with bcrypt)';
