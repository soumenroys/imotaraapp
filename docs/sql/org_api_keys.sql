-- ============================================================
-- docs/sql/org_api_keys.sql
-- Phase 4C: API key management for Enterprise orgs
--
-- Run in Supabase SQL Editor after org_schema.sql.
-- ============================================================

-- ── API_KEYS ──────────────────────────────────────────────────────────────────
-- One row per API key. The actual key value is NEVER stored — only a SHA-256 hash.
-- Org admins generate keys in the dashboard; the plaintext is shown once.
-- key_prefix stores first 8 chars (e.g. "imk_abc1") for display/identification.

create table if not exists api_keys (
  id           uuid        primary key default gen_random_uuid(),
  org_id       uuid        not null references organizations(id) on delete cascade,
  name         text        not null,              -- human label e.g. "HR dashboard prod"
  key_prefix   text        not null,              -- first 8 chars shown in UI (not secret)
  key_hash     text        not null unique,        -- SHA-256 hex of full key
  scopes       text[]      not null default '{}', -- e.g. ARRAY['read:stats','read:members']
  rate_limit   integer     not null default 100,  -- requests per minute
  last_used_at timestamptz,
  created_by   uuid        references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  revoked_at   timestamptz                         -- NULL = active
);

create index if not exists api_keys_org_idx  on api_keys (org_id, revoked_at);
create index if not exists api_keys_hash_idx on api_keys (key_hash);

-- RLS: org admins can read their own org's keys; service_role has full access
alter table api_keys enable row level security;

create policy "Org admins read own api keys"
  on api_keys for select
  using (
    exists (
      select 1 from org_members om
      where om.org_id  = api_keys.org_id
        and om.user_id = auth.uid()
        and om.role    in ('owner', 'admin')
        and om.status  = 'active'
    )
  );

-- ── Verify function ───────────────────────────────────────────────────────────
-- Used by API routes to validate an incoming key and return the org context.
-- Returns one row with org details if the key is valid and not revoked.

create or replace function verify_api_key(p_key_hash text)
returns table (
  key_id     uuid,
  org_id     uuid,
  org_name   text,
  org_tier   text,
  scopes     text[],
  rate_limit integer
)
language sql
security definer
set search_path = public
as $$
  select
    k.id        as key_id,
    o.id        as org_id,
    o.name      as org_name,
    o.tier      as org_tier,
    k.scopes,
    k.rate_limit
  from api_keys k
  join organizations o on o.id = k.org_id
  where k.key_hash  = p_key_hash
    and k.revoked_at is null
    and o.status     = 'active'
    and (o.expires_at is null or o.expires_at > now())
  limit 1;
$$;

revoke execute on function verify_api_key from public, anon, authenticated;
grant  execute on function verify_api_key to service_role;
