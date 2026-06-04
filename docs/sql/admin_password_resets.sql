-- ============================================================
-- docs/sql/admin_password_resets.sql
-- Password reset tokens for super-admins who forgot their password.
-- Token expires in 15 minutes and is single-use.
-- Run in Supabase SQL Editor.
-- ============================================================

create table if not exists admin_password_resets (
  id          uuid        primary key default gen_random_uuid(),
  admin_id    uuid        not null references super_admins(id) on delete cascade,
  token_hash  text        not null unique,   -- SHA-256 of the reset token
  expires_at  timestamptz not null default (now() + interval '15 minutes'),
  used_at     timestamptz,                   -- null = not yet used
  created_at  timestamptz not null default now()
);

create index if not exists admin_password_resets_token_idx
  on admin_password_resets (token_hash);

create index if not exists admin_password_resets_admin_idx
  on admin_password_resets (admin_id, created_at desc);

-- No RLS — service_role only
