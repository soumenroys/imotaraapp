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


-- ── 7. EMAIL FORMAT — enforced by the database, not by a code path ───────────
--
-- The lower() checks above guarantee normalisation but not shape: 'broken@invalid'
-- and 'deepa@childcare' both pass them, and Resend rejects both at send time.
--
-- Validating in the admin API only protects addresses that arrive THROUGH the
-- admin API. A direct edit in the Supabase table editor, a future CSV importer,
-- or a backfill script would all bypass it. Putting the rule here means a
-- malformed address cannot be stored by any route, so the "malformed reaches
-- the send queue" case genuinely cannot arise.
--
-- The pattern is deliberately pragmatic rather than RFC 5322 complete: no
-- whitespace, exactly one @, and a dot in the domain. A full RFC regex is
-- famously unreadable AND rejects some legitimately deliverable addresses.
-- This rejects every malformed example we have seen while permitting
-- everything real, including a+tag@sub.domain.co.uk.
--
-- NOTE: this is what still catches *malformed*. It cannot catch an address
-- that is well-formed but does not exist — nobody@gmail.com passes here and
-- always will. That failure surfaces later as a bounce, via the webhook, and
-- is why broadcast_sends distinguishes 'failed' from 'bounced'.

do $$
declare
  t text;
  tables text[] := array[
    'broadcast_recipients',
    'broadcast_suppressions',
    'broadcast_interest_submissions'
  ];
begin
  foreach t in array tables loop
    if not exists (
      select 1 from pg_constraint
       where conname = t || '_email_format_chk'
    ) then
      execute format(
        'alter table %I add constraint %I check (email ~ %L)',
        t, t || '_email_format_chk',
        '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
      );
    end if;
  end loop;

  -- broadcasts.from_email is the sending admin's own address; same rule.
  if not exists (
    select 1 from pg_constraint where conname = 'broadcasts_from_email_format_chk'
  ) then
    execute format(
      'alter table broadcasts add constraint %I check (from_email ~ %L)',
      'broadcasts_from_email_format_chk',
      '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
    );
  end if;

  -- broadcast_sends.email is copied from a recipient row that already passed,
  -- but the send record outlives the recipient, so constrain it too.
  if not exists (
    select 1 from pg_constraint where conname = 'broadcast_sends_email_format_chk'
  ) then
    execute format(
      'alter table broadcast_sends add constraint %I check (email ~ %L)',
      'broadcast_sends_email_format_chk',
      '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
    );
  end if;
end $$;


-- ── 8. SENDER DISPLAY NAME ───────────────────────────────────────────────────
--
-- from_email is a bare address, enforced by the format constraint above. Sent
-- alone, recipients see "suchismita.sen@imotara.com" rather than
-- "Suchismita Sen" — and the entire premise of this feature is that a
-- broadcast comes from a person, not a system.
--
-- Snapshotted for the same reason as from_email: joining super_admins at send
-- time would make the historical record change if the admin is later renamed
-- or removed, and the record is meant to say who sent it AT THE TIME.
--
-- Nullable, because a broadcast created before this column existed has no
-- name to recover; the send path falls back to the bare address.

alter table broadcasts add column if not exists from_name text;


-- ── 9. HISTORY SUMMARY ───────────────────────────────────────────────────────
--
-- Per-broadcast tallies in ONE round trip. The alternative is a count query
-- per broadcast per status — 200 broadcasts x 7 statuses is 1,400 queries to
-- render one screen — or fetching every send row to count in JavaScript, which
-- gets slower for the life of the product.
--
-- security definer + a locked-down search_path, matching the pattern used by
-- the rate-limit functions: callers reach this through service_role from an
-- admin route, and the tables themselves stay default-deny under RLS.

create or replace function broadcast_history_summary()
returns table (
  broadcast_id  uuid,
  queued        bigint,
  sent          bigint,
  delivered     bigint,
  bounced       bigint,
  complained    bigint,
  skipped       bigint,
  failed        bigint,
  attempted     bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    s.broadcast_id,
    count(*) filter (where s.status = 'queued')     as queued,
    count(*) filter (where s.status = 'sent')       as sent,
    count(*) filter (where s.status = 'delivered')  as delivered,
    count(*) filter (where s.status = 'bounced')    as bounced,
    count(*) filter (where s.status = 'complained') as complained,
    count(*) filter (where s.status = 'skipped')    as skipped,
    count(*) filter (where s.status = 'failed')     as failed,
    -- attempted excludes 'skipped': those were never sent, so counting them
    -- would understate the delivery rate against messages actually attempted.
    count(*) filter (where s.status <> 'skipped')   as attempted
  from broadcast_sends s
  group by s.broadcast_id;
$$;

revoke all on function broadcast_history_summary() from public, anon, authenticated;
grant execute on function broadcast_history_summary() to service_role;


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


-- ────────────────────────────────────────────────────────────────────────────
-- 10. The composer's source text                                     (BC-19)
-- ────────────────────────────────────────────────────────────────────────────
-- body_html and body_text are RENDERED OUTPUT. Both are generated on the
-- server from this column by src/lib/broadcast/markup.ts, and neither is ever
-- accepted from a client — which is what stops a crafted request putting
-- arbitrary HTML into mail signed by our domain.
--
-- The column exists because output cannot be edited back into input. Without
-- it, reopening a draft would mean parsing our own HTML to guess what the
-- admin originally typed, and every save would degrade the message a little
-- more.

alter table broadcasts add column if not exists body_source text;

-- Existing drafts (there are none in production at the time of writing, but
-- this keeps the migration honest if run late) get their plain-text version as
-- a starting point rather than an empty editor.
update broadcasts
   set body_source = coalesce(body_text, '')
 where body_source is null;


-- ────────────────────────────────────────────────────────────────────────────
-- 11. Reply-To                                                       (BC-34)
-- ────────────────────────────────────────────────────────────────────────────
-- from_email is the address the message is SENT from, and it has to be on the
-- domain Resend verified. reply_to is where an answer should go, and it does
-- not: it is the admin who actually wrote the broadcast, whatever their login
-- happens to be.
--
-- Separating them is what lets an owner whose login is a personal address send
-- a broadcast at all — the company address carries it, their own address
-- receives the replies, and created_by still records who wrote it. Snapshotted
-- like from_email rather than joined at send time, so the record survives that
-- admin later being renamed or removed.

alter table broadcasts add column if not exists reply_to text;

update broadcasts set reply_to = from_email where reply_to is null;


-- ────────────────────────────────────────────────────────────────────────────
-- 12. Closing the gap audit                              (G1, G3, G6, G7)
-- ────────────────────────────────────────────────────────────────────────────
-- One migration for four gaps found on 2026-09-04. Idempotent like the rest.

-- G3 — a transient failure used to leave a row 'queued' forever, retried on
-- every cron tick with nothing counting the attempts. A run could sit in
-- 'sending' indefinitely and the only symptom was a number nobody watched.
alter table broadcast_sends add column if not exists attempts integer not null default 0;

-- G6 — send later. Null means send as soon as the queue is drained, which is
-- the behaviour everything had before this column existed.
alter table broadcasts add column if not exists scheduled_at timestamptz;

create index if not exists broadcasts_scheduled_idx
  on broadcasts (scheduled_at)
  where status = 'scheduled';

-- 'scheduled' has to be a real status rather than a draft with a date on it:
-- a draft can still be edited, and a message that is already committed to go
-- out at a time must not be.
do $
declare c text;
begin
  select conname into c
    from pg_constraint
   where conrelid = 'broadcasts'::regclass
     and contype = 'c'
     and pg_get_constraintdef(oid) ilike '%status%';

  if c is not null then
    execute format('alter table broadcasts drop constraint %I', c);
  end if;

  alter table broadcasts add constraint broadcasts_status_check
    check (status in ('draft','scheduled','sending','sent','failed','paused'));
end $;

-- G7 — confirmed opt-in. A form submission proves someone typed an address,
-- not that they own it. Until this is set, the address has only been claimed.
alter table broadcast_interest_submissions
  add column if not exists confirmed_at timestamptz;

alter table broadcast_interest_submissions
  add column if not exists confirmation_sent_at timestamptz;

-- Existing submissions predate confirmation and are grandfathered rather than
-- silently treated as unconfirmed, which would misrepresent them in the panel.
update broadcast_interest_submissions
   set confirmed_at = created_at
 where confirmed_at is null;
