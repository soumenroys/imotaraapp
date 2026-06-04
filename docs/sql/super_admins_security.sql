-- ============================================================
-- docs/sql/super_admins_security.sql
-- Security hardening for the super-admin system:
--   1. Account lockout tracking (failed attempts)
--   2. Session metadata (IP, user agent)
--   3. Login audit log
--
-- Run after super_admins.sql.
-- ============================================================

-- ── 1. Account lockout columns on super_admins ────────────────────────────────
alter table super_admins
  add column if not exists failed_attempts integer     not null default 0,
  add column if not exists locked_until    timestamptz,
  add column if not exists last_failed_at  timestamptz;

-- ── 2. Session metadata — IP + user-agent for session management UI ───────────
alter table admin_sessions
  add column if not exists ip_address text,
  add column if not exists user_agent text,
  add column if not exists last_used_at timestamptz;

-- ── 3. Admin login audit log ──────────────────────────────────────────────────
-- Immutable record of every login attempt (success and failure).
-- Never deleted — used for security auditing.

create table if not exists admin_login_audit (
  id          uuid        primary key default gen_random_uuid(),
  email       text        not null,
  ip_address  text,
  user_agent  text,
  success     boolean     not null,
  failure_reason text,            -- null on success
  created_at  timestamptz not null default now()
);

create index if not exists admin_login_audit_email_idx on admin_login_audit (email, created_at desc);
create index if not exists admin_login_audit_ip_idx    on admin_login_audit (ip_address, created_at desc);

-- No RLS — service_role only
