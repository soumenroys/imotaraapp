-- ============================================================
-- docs/sql/org_schema.sql
-- Phase 1A: Multi-tenancy foundation — organizations, org_members, org_invites
--
-- Run order:
--   1. org_schema.sql          (this file)
--   2. org_audit_log.sql
--   3. org_licenses_alter.sql
--   4. org_functions.sql
--
-- Run in Supabase SQL Editor with service-role (postgres superuser).
-- All client mutations go through service-role API routes — no direct
-- client writes are allowed on any of these tables.
-- ============================================================


-- ── 1. ORGANIZATIONS ──────────────────────────────────────────────────────────
-- One row per corporate / NGO / EDU / Govt account.
-- Created by Imotara super-admin via /admin panel (manual approval flow).
-- Users can submit an org creation request via /org/new (status='pending').

create table if not exists organizations (
  id               uuid        primary key default gen_random_uuid(),

  -- Display and URL identity
  name             text        not null,
  slug             text        not null,   -- URL-safe, e.g. "acme-corp", "hope-ngo"

  -- Org type — determines pricing tier, does NOT affect feature gates
  -- commercial | ngo | edu | govt
  billing_type     text        not null default 'commercial',

  -- License tier granted to this org and all its members
  -- edu | enterprise  (family/pro/plus not used for orgs)
  tier             text        not null default 'enterprise',

  -- Lifecycle status
  -- pending → active → suspended | cancelled
  status           text        not null default 'pending',

  -- Seat management
  seats_purchased  integer     not null default 0,
  seats_used       integer     not null default 0,

  -- Ownership
  owner_user_id    uuid        references auth.users(id) on delete set null,

  -- License window — NULL means no expiry
  expires_at       timestamptz,

  -- Optional JSON for Phase 4 features (SSO config, branding, API settings)
  -- Stored as JSONB so future fields don't need schema migrations
  org_settings     jsonb       not null default '{}'::jsonb,

  -- Internal Imotara admin notes (billing type, discount reason, contact, etc.)
  notes            text,

  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- Unique slug per org
create unique index if not exists organizations_slug_idx
  on organizations (slug);

-- Fast status-based admin queries
create index if not exists organizations_status_idx
  on organizations (status, created_at desc);

-- Owner lookup
create index if not exists organizations_owner_idx
  on organizations (owner_user_id);

-- Auto-update updated_at on row change
create or replace function update_organizations_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_organizations_updated_at on organizations;
create trigger trg_organizations_updated_at
  before update on organizations
  for each row execute function update_organizations_updated_at();

-- RLS (enable only — policy that references org_members added at end of file after org_members exists)
alter table organizations enable row level security;


-- ── 2. ORG_MEMBERS ────────────────────────────────────────────────────────────
-- One row per user per org.
-- role: owner | admin | member
-- owner  — created org, full control, cannot be removed except by Imotara admin
-- admin  — can invite/remove members, view analytics, change org settings
-- member — regular user; inherits org license automatically

create table if not exists org_members (
  id           uuid        primary key default gen_random_uuid(),
  org_id       uuid        not null references organizations(id) on delete cascade,
  user_id      uuid        references auth.users(id) on delete set null,
  role         text        not null default 'member',  -- owner | admin | member
  status       text        not null default 'active',  -- active | suspended | removed
  joined_at    timestamptz not null default now(),
  invited_by   uuid        references auth.users(id) on delete set null,

  -- One membership per user per org
  unique (org_id, user_id)
);

create index if not exists org_members_org_idx
  on org_members (org_id, status);

create index if not exists org_members_user_idx
  on org_members (user_id, status);

-- RLS
alter table org_members enable row level security;

-- Users can read their own membership row
create policy "Members read own membership"
  on org_members for select
  using (auth.uid() = user_id);

-- Org admins and owners can read all members in their org
create policy "Org admins read all members"
  on org_members for select
  using (
    exists (
      select 1 from org_members om
      where om.org_id = org_members.org_id
        and om.user_id = auth.uid()
        and om.role in ('owner', 'admin')
        and om.status = 'active'
    )
  );

-- No client-side writes


-- ── 3. ORG_INVITES ────────────────────────────────────────────────────────────
-- One row per pending invitation (by email, not by user_id — user may not exist yet).
-- Token is UUID used in the invite link: /org/invite/[token]
-- Accepts single-email invites and bulk CSV invites (multiple rows, same org_id).

create table if not exists org_invites (
  id           uuid        primary key default gen_random_uuid(),
  org_id       uuid        not null references organizations(id) on delete cascade,
  email        text        not null,
  role         text        not null default 'member',  -- admin | member
  token        uuid        not null default gen_random_uuid(),
  invited_by   uuid        references auth.users(id) on delete set null,
  expires_at   timestamptz not null default (now() + interval '7 days'),
  accepted_at  timestamptz,              -- NULL = pending
  created_at   timestamptz not null default now(),

  -- Only one pending invite per email per org
  unique (org_id, email)
);

-- Token lookup (for /org/invite/[token] page)
create unique index if not exists org_invites_token_idx
  on org_invites (token);

create index if not exists org_invites_org_idx
  on org_invites (org_id, accepted_at, expires_at);

-- RLS
alter table org_invites enable row level security;

-- Anyone can read an invite by token (needed for the acceptance page — user may not be signed in yet)
create policy "Anyone can read invite by token"
  on org_invites for select
  using (true);

-- Org admins and owners can read all invites for their org
create policy "Org admins read org invites"
  on org_invites for select
  using (
    exists (
      select 1 from org_members om
      where om.org_id = org_invites.org_id
        and om.user_id = auth.uid()
        and om.role in ('owner', 'admin')
        and om.status = 'active'
    )
  );

-- No client-side inserts — invite creation goes through API route


-- ── DEFERRED RLS POLICIES (require all 3 tables to exist) ────────────────────

-- organizations: members can read their own org
-- (defined here because the USING clause references org_members)
create policy "Org members can read their org"
  on organizations for select
  using (
    auth.uid() = owner_user_id
    or exists (
      select 1 from org_members
      where org_members.org_id = organizations.id
        and org_members.user_id = auth.uid()
        and org_members.status = 'active'
    )
  );
