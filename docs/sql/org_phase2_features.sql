-- ============================================================
-- docs/sql/org_phase2_features.sql
-- Phase 4 remaining features: cohorts, referrals, emotion tracking
--
-- Run in Supabase SQL Editor after org_schema.sql and org_api_keys.sql.
-- ============================================================


-- ── 1. COHORTS (Classroom / Team / Department mode) ───────────────────────────
-- Groups within an org. EDU uses cohorts as "classrooms".
-- Enterprise uses them as "teams" or "departments".
-- Org admins assign members to cohorts and set a default companion tone.

create table if not exists cohorts (
  id              uuid        primary key default gen_random_uuid(),
  org_id          uuid        not null references organizations(id) on delete cascade,
  name            text        not null,
  description     text,
  -- Shared companion tone policy for all members of this cohort.
  -- Mirrors the tone values used in ToneContextPayload: close_friend | calm_companion | coach | mentor
  tone_policy     text        not null default 'close_friend',
  -- Optional seat limit for the cohort (null = no limit within org seats)
  seat_limit      integer,
  created_by      uuid        references auth.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists cohorts_org_idx on cohorts (org_id);

-- One user can be in at most one cohort per org
create table if not exists cohort_members (
  cohort_id  uuid not null references cohorts(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  added_by   uuid references auth.users(id) on delete set null,
  added_at   timestamptz not null default now(),
  primary key (cohort_id, user_id)
);

create index if not exists cohort_members_user_idx on cohort_members (user_id);

-- RLS
alter table cohorts        enable row level security;
alter table cohort_members enable row level security;

create policy "Org admins read cohorts"
  on cohorts for select
  using (
    exists (
      select 1 from org_members om
      where om.org_id = cohorts.org_id
        and om.user_id = auth.uid()
        and om.role in ('owner', 'admin')
        and om.status = 'active'
    )
  );

create policy "Org members read own cohort"
  on cohort_members for select
  using (auth.uid() = user_id);


-- ── 2. REFERRAL CODES (NGO revenue sharing) ──────────────────────────────────
-- NGOs distribute referral codes. When a user signs up or upgrades via a code,
-- the NGO earns a commission (default 10% of first-year revenue).

create table if not exists referral_codes (
  id              uuid        primary key default gen_random_uuid(),
  org_id          uuid        references organizations(id) on delete set null,
  code            text        not null unique,       -- e.g. "HOPE-NGO-2026"
  description     text,                              -- internal label
  commission_rate numeric(5,2) not null default 10.00, -- percentage (10 = 10%)
  uses_count      integer     not null default 0,
  active          boolean     not null default true,
  created_by      uuid        references auth.users(id) on delete set null,
  expires_at      timestamptz,                       -- null = no expiry
  created_at      timestamptz not null default now()
);

create index if not exists referral_codes_org_idx  on referral_codes (org_id);
create index if not exists referral_codes_code_idx on referral_codes (code);

-- Tracks each referral event (signup or upgrade) attributed to a code
create table if not exists referral_attributions (
  id                uuid        primary key default gen_random_uuid(),
  referral_code_id  uuid        not null references referral_codes(id),
  referred_user_id  uuid        references auth.users(id) on delete set null,
  -- 'signup' = user created account via code, 'upgrade' = user upgraded via code
  event_type        text        not null default 'signup',
  tier              text,                            -- tier they upgraded to
  revenue_paise     integer     not null default 0,  -- total revenue from this event
  commission_paise  integer     not null default 0,  -- commission owed to org
  created_at        timestamptz not null default now()
);

create index if not exists referral_attributions_code_idx
  on referral_attributions (referral_code_id);

-- RLS
alter table referral_codes         enable row level security;
alter table referral_attributions  enable row level security;

create policy "Org admins read own referral codes"
  on referral_codes for select
  using (
    org_id is not null and exists (
      select 1 from org_members om
      where om.org_id  = referral_codes.org_id
        and om.user_id = auth.uid()
        and om.role    in ('owner', 'admin')
        and om.status  = 'active'
    )
  );

create policy "Org admins read own attributions"
  on referral_attributions for select
  using (
    exists (
      select 1
      from referral_codes rc
      join org_members om on om.org_id = rc.org_id
      where rc.id         = referral_attributions.referral_code_id
        and om.user_id    = auth.uid()
        and om.role       in ('owner', 'admin')
        and om.status     = 'active'
    )
  );


-- ── 3. EMOTION TRACKING — extend usage_events ────────────────────────────────
-- Add emotion label to each chat reply event so analytics can show
-- emotion trends (stress, joy, sadness, anxiety, etc.) per org.

alter table usage_events
  add column if not exists emotion text;   -- detected emotion from the chat reply

create index if not exists usage_events_emotion_idx
  on usage_events (user_id, emotion, created_at desc)
  where emotion is not null;


-- ── 4. ORG_SETTINGS FIELDS (stored in existing JSONB column) ─────────────────
-- No new table needed — all stored in organizations.org_settings JSONB.
-- Shape documented here for reference:
--
-- org_settings = {
--   "logo_url":       "https://...",          -- Phase 4B branding
--   "accent_color":   "#4f46e5",              -- Phase 4B branding
--   "brand_name":     "Acme Wellness",        -- Phase 4B branding
--
--   "saml": {                                  -- Phase 4A SSO
--     "entity_id":   "https://...",
--     "sso_url":     "https://...",
--     "certificate": "-----BEGIN CERT...",
--     "email_domain": "acme.com",             -- auto-join on SSO login
--     "status":      "pending" | "active"
--   },
--
--   "data_residency": "us" | "eu" | "apac",  -- preferred region (enforcement manual)
--
--   "embed_key": "uuid",                      -- for LMS iframe embed auth
--   "embed_allowed_domains": ["*.moodle.org"] -- CORS allowlist for embedding
-- }
