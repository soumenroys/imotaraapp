-- ============================================================
-- docs/sql/super_admins.sql
-- Multi-user super-admin system
--
-- Run in Supabase SQL Editor.
-- After running, use /api/admin/auth/seed to create the first owner account.
-- ADMIN_SECRET env var remains as an emergency fallback only.
-- ============================================================

-- ── SUPER_ADMINS ──────────────────────────────────────────────────────────────
-- One row per Imotara platform admin (not org admins — those are in org_members).
-- role: 'owner' (full access + manage other admins) | 'admin' (full access)
-- password is stored as: salt:scrypt_hash (64-byte key, hex encoded)

create table if not exists super_admins (
  id              uuid        primary key default gen_random_uuid(),
  email           text        not null unique,
  name            text        not null,
  password_hash   text        not null,   -- "salt:hash" — scrypt, never plaintext
  role            text        not null default 'admin',  -- 'owner' | 'admin'
  active          boolean     not null default true,
  created_by      uuid        references super_admins(id) on delete set null,
  last_login_at   timestamptz,
  created_at      timestamptz not null default now()
);

create index if not exists super_admins_email_idx on super_admins (email);

-- No RLS — only accessible via service_role from API routes


-- ── ADMIN_SESSIONS ────────────────────────────────────────────────────────────
-- Session tokens for super-admin logins.
-- The actual token is sent to the browser as an httpOnly cookie.
-- Only the SHA-256 hash is stored here — the plaintext is never persisted.

create table if not exists admin_sessions (
  id          uuid        primary key default gen_random_uuid(),
  admin_id    uuid        not null references super_admins(id) on delete cascade,
  token_hash  text        not null unique,   -- SHA-256(session_token)
  expires_at  timestamptz not null default (now() + interval '8 hours'),
  created_at  timestamptz not null default now()
);

create index if not exists admin_sessions_token_idx  on admin_sessions (token_hash);
create index if not exists admin_sessions_admin_idx  on admin_sessions (admin_id);
create index if not exists admin_sessions_expiry_idx on admin_sessions (expires_at);

-- No RLS — only accessible via service_role


-- ── CLEANUP FUNCTION ─────────────────────────────────────────────────────────
-- Call periodically to remove expired sessions (or set up a cron in Supabase).

create or replace function cleanup_expired_admin_sessions()
returns void language sql security definer set search_path = public as $$
  delete from admin_sessions where expires_at < now();
$$;

-- ── BOOTSTRAP NOTE ───────────────────────────────────────────────────────────
-- After running this migration, create the first owner admin by calling:
--
--   POST https://imotara.com/api/admin/auth/seed
--   Body: { "email": "you@imotara.com", "name": "Your Name", "password": "strong-pass" }
--
-- This endpoint only works when super_admins is empty.
-- After first admin is created, the seed endpoint returns 409.
-- From then on, owners can add more admins from /admin → Super Admins tab.
