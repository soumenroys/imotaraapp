-- ============================================================
-- docs/sql/broadcast_v1.sql
-- Admin broadcast email — v1 schema
--
-- Owner-role admins compose an email and send it to a consented
-- recipient list, from their own @imotara.com address via Resend.
--
-- Run in Supabase SQL Editor. Safe to re-run (idempotent).
-- ============================================================
--
-- Notes on two deliberate choices:
--
--   1. EMAIL COLUMNS ARE `text`, NOT `citext`.
--      No migration in this repo enables an extension, and every existing
--      email column is plain text. Case-insensitivity is enforced instead by
--      a `email = lower(email)` check constraint on every email column, so
--      the database rejects a non-normalised address rather than trusting the
--      caller. Callers must lowercase before writing.
--
--   2. RLS IS ENABLED WITH NO POLICIES.
--      anon/authenticated therefore get default-deny; service_role bypasses
--      RLS. This is the lockdown pattern already used for admin and
--      rate-limit tables. It is what stops the anon key reading these tables
--      over the REST API — the failure mode found and fixed in July 2026.
--      Every read and write goes through an admin API route.
-- ============================================================


-- ── 1. LISTS ─────────────────────────────────────────────────────────────────
-- A named group of recipients. An address may sit on several lists.

create table if not exists broadcast_lists (
  id          uuid        primary key default gen_random_uuid(),
  name        text        not null,
  created_by  uuid        references super_admins(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create unique index if not exists broadcast_lists_name_idx
  on broadcast_lists (lower(name));

alter table broadcast_lists enable row level security;
-- No policies — admin API routes only (service_role); anon/authenticated deny.


-- ── 2. RECIPIENTS ────────────────────────────────────────────────────────────
-- One row per address per list, carrying its CONSENT PROVENANCE.
--
-- The provenance columns are NOT optional. GDPR requires the controller to
-- demonstrate consent, not merely assert it. Every `source` value names
-- something the PERSON did — there is deliberately no 'found_online' or
-- 'scraped' value, because a vague source becomes a laundering route for
-- addresses that were never offered.

create table if not exists broadcast_recipients (
  id            uuid        primary key default gen_random_uuid(),
  list_id       uuid        not null references broadcast_lists(id) on delete cascade,
  email         text        not null check (email = lower(email)),
  name          text,

  -- provenance — all four required
  source        text        not null check (source in (
                              'event',          -- gave it at a demonstration or event
                              'meeting',        -- gave it at a meeting or visit
                              'email',          -- emailed us
                              'whatsapp',       -- messaged us on WhatsApp
                              'social',         -- messaged or commented on our social media
                              'website_form',   -- filled in the form on imotara.com
                              'phone',          -- called us
                              'app_signup'      -- signed up in the app
                            )),
  source_detail text        not null check (length(btrim(source_detail)) > 0),
  collected_at  date        not null,
  added_by      uuid        references super_admins(id) on delete set null,

  created_at    timestamptz not null default now()
);

create unique index if not exists broadcast_recipients_list_email_idx
  on broadcast_recipients (list_id, email);

create index if not exists broadcast_recipients_email_idx
  on broadcast_recipients (email);

alter table broadcast_recipients enable row level security;
-- No policies — admin API routes only.


-- ── 3. SUPPRESSIONS ──────────────────────────────────────────────────────────
-- GLOBAL, not per list. An unsubscribe or hard bounce must apply everywhere,
-- and must survive deletion of the list the address happened to be on — hence
-- no foreign key to broadcast_lists and no cascade.

create table if not exists broadcast_suppressions (
  email               text        primary key check (email = lower(email)),
  reason              text        not null check (reason in (
                                    'unsubscribed', 'hard_bounce', 'complaint'
                                  )),
  source_broadcast_id uuid,       -- which send caused it; intentionally not FK-constrained
  created_at          timestamptz not null default now()
);

alter table broadcast_suppressions enable row level security;
-- No policies — admin API routes and the public unsubscribe route
-- (service_role) only.


-- ── 4. BROADCASTS ────────────────────────────────────────────────────────────
-- The message. A sent broadcast is IMMUTABLE — duplicate it to revise.
-- `from_email` is snapshotted at send time rather than joined from
-- super_admins, so the historical record survives the admin being renamed,
-- deactivated or deleted.
--
-- `message_type` drives both the headers and the likely inbox tab:
--   'broadcast'   → carries List-Unsubscribe + one-click; Gmail files under
--                   Promotions. Required for anything marketing-shaped.
--   'operational' → genuinely transactional (renewals, account changes); no
--                   unsubscribe because the mail is not optional. Recorded so
--                   that dressing marketing up as operational is auditable.

create table if not exists broadcasts (
  id           uuid        primary key default gen_random_uuid(),
  subject      text        not null,
  body_html    text        not null default '',
  body_text    text        not null default '',
  message_type text        not null default 'broadcast'
                           check (message_type in ('broadcast', 'operational')),
  list_id      uuid        references broadcast_lists(id) on delete set null,
  status       text        not null default 'draft'
                           check (status in ('draft','sending','sent','failed','paused')),
  from_email   text        not null check (from_email = lower(from_email)),
  created_by   uuid        references super_admins(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  started_at   timestamptz,
  finished_at  timestamptz
);

create index if not exists broadcasts_status_idx
  on broadcasts (status, created_at desc);

alter table broadcasts enable row level security;
-- No policies — admin API routes only.


-- ── 5. SENDS ─────────────────────────────────────────────────────────────────
-- One row per recipient per broadcast. This is both the send queue and the
-- audit trail.
--
-- 'skipped' is recorded rather than the row being omitted, so the counts on
-- the review screen reconcile: "52 on the list, 3 skipped, 49 will receive".
-- Silently dropping a suppressed address would make the arithmetic a mystery.

create table if not exists broadcast_sends (
  id           uuid        primary key default gen_random_uuid(),
  broadcast_id uuid        not null references broadcasts(id) on delete cascade,
  email        text        not null check (email = lower(email)),
  status       text        not null default 'queued'
                           check (status in (
                             'queued','sent','delivered','bounced',
                             'complained','skipped','failed'
                           )),
  skip_reason  text        check (skip_reason in ('unsubscribed','hard_bounce','complaint')),
  resend_id    text,       -- Resend message id; how the webhook finds this row
  error        text,
  queued_at    timestamptz not null default now(),
  sent_at      timestamptz,
  delivered_at timestamptz
);

create unique index if not exists broadcast_sends_broadcast_email_idx
  on broadcast_sends (broadcast_id, email);

-- The cron drains on this predicate — keep it cheap.
create index if not exists broadcast_sends_queue_idx
  on broadcast_sends (status, queued_at)
  where status = 'queued';

-- Webhook lookups by Resend message id.
create index if not exists broadcast_sends_resend_id_idx
  on broadcast_sends (resend_id)
  where resend_id is not null;

-- Warm-up ceiling: "how many went out today" is derived from this, not
-- tracked in a separate counter that could drift.
create index if not exists broadcast_sends_sent_at_idx
  on broadcast_sends (sent_at)
  where sent_at is not null;

alter table broadcast_sends enable row level security;
-- No policies — admin API routes, the send cron and the Resend webhook
-- (all service_role) only.


-- ── 6. PUBLIC INTEREST SUBMISSIONS ───────────────────────────────────────────
-- The public form on imotara.com. Deliberately a separate table from
-- broadcast_recipients: a submission is a raw inbound enquiry, and an owner
-- decides whether it becomes a recipient. `ip` and `user_agent` are captured
-- because a form submission with a timestamp and origin is stronger evidence
-- of consent than an address typed in by hand.
--
-- RLS is enabled with no policies here too. The public form must NOT insert
-- with the anon key — it posts to an API route that writes with service_role,
-- so rate limiting and honeypot checks cannot be bypassed by calling REST
-- directly.

create table if not exists broadcast_interest_submissions (
  id         uuid        primary key default gen_random_uuid(),
  email      text        not null check (email = lower(email)),
  name       text,
  message    text,
  ip         text,
  user_agent text,
  status     text        not null default 'new'
                         check (status in ('new','added_to_list','ignored')),
  created_at timestamptz not null default now()
);

create index if not exists broadcast_interest_submissions_status_idx
  on broadcast_interest_submissions (status, created_at desc);

create index if not exists broadcast_interest_submissions_email_idx
  on broadcast_interest_submissions (email);

alter table broadcast_interest_submissions enable row level security;
-- No policies — the public form's API route (service_role) writes; the admin
-- API reads. anon/authenticated get default-deny.


-- ── Verification ─────────────────────────────────────────────────────────────
-- Run this after the migration. It must return EXACTLY 6 rows, every one
-- showing rls_enabled = true and policy_count = 0 — that combination is what
-- makes these tables service-role-only.
--
-- Note `c.relkind = 'r'`: without it pg_class also returns the 16 indexes and
-- primary keys, which always report rls_enabled = false because RLS does not
-- apply to an index. That is harmless but looks alarming, so filter to
-- ordinary tables.
--
--   select c.relname                                as table_name,
--          c.relrowsecurity                         as rls_enabled,
--          (select count(*) from pg_policies p
--             where p.schemaname = n.nspname
--               and p.tablename  = c.relname)       as policy_count
--     from pg_class c
--     join pg_namespace n on n.oid = c.relnamespace
--    where n.nspname   = 'public'
--      and c.relkind   = 'r'          -- ordinary tables only
--      and c.relname like 'broadcast%'
--    order by c.relname;
--
-- Verified 2026-09-03 against production: 6 tables, all true / 0.
