-- ============================================================
-- docs/sql/social_autopost_v1.sql
-- Scheduled + hand-written social posting — v1 schema
--
-- Design: docs/social-autopost-design.md
--
-- Run in Supabase SQL Editor. Safe to re-run (idempotent).
-- ============================================================
--
-- Four deliberate choices, each of which exists because the alternative
-- failed somewhere in this codebase before:
--
--   1. RLS IS ENABLED WITH NO POLICIES.
--      anon/authenticated get default-deny; service_role bypasses RLS. The
--      same lockdown pattern as the admin, broadcast and rate-limit tables.
--      It is what stops the anon key reading these rows over the REST API —
--      and these rows include platform ACCESS TOKENS. ⛔ Do not add a policy
--      here to make a client-side query work; add an admin API route.
--
--   2. UNIQUENESS IS A DATABASE CONSTRAINT, NOT A PROMPT INSTRUCTION.
--      `social_topics_used.subject_hash` and `social_visuals_used.recipe_hash`
--      are globally UNIQUE. A model asked to "write something new" repeats
--      itself inside a fortnight; a unique index does not. The generator reads
--      the register to exclude, and the index is the thing that actually
--      guarantees it.
--
--   3. THE AUTO-PUBLISH / LANGUAGE RULE IS ENFORCED BY A TRIGGER.
--      A schedule may not auto-publish in a language nobody here can read.
--      That could have lived in one API route — but then it holds only for as
--      long as every future route remembers it. It is a trigger so it holds
--      for every writer, including a hand-run SQL update at 2am.
--
--   4. A SCHEDULE WITH NO LANGUAGE IS REJECTED, NOT DEFAULTED.
--      `concreteLang('auto')` resolves to 'en' elsewhere in this codebase, and
--      a schedule that quietly fell back to English would post in the wrong
--      language for months before anyone noticed. The check constraint makes
--      the empty case impossible rather than silent.
-- ============================================================


-- ── 1. LANGUAGE TIERS ────────────────────────────────────────────────────────
-- The 22 the product supports, and the one fact that matters here: can anybody
-- on this side READ it? A reply is seen by one person and gone. A post is
-- permanent, quotable and screenshot — so a language nobody here reads may be
-- written, pictured and queued, but never published unattended.
--
-- `reviewed` moves to true when a speaker has read real drafts. It is a data
-- change, not a code change, deliberately: the day a native speaker appears is
-- not the day to be waiting on a deploy.

create table if not exists social_language_tiers (
  code        text        primary key,
  name        text        not null,

  -- Can anybody here read a draft in it and tell a person's voice from a
  -- translation's?
  reviewed    boolean     not null default false,
  reviewed_by text,
  reviewed_at timestamptz,

  -- 🔑 AND THE SECOND, SEPARATE CONDITION: does an abuse-and-profanity list
  -- exist for this language at all? The owner's instruction is that posts carry
  -- no abusive words; in a language with no list, nothing can check that.
  --
  -- ⚠️ These two are NOT the same fact and must not be collapsed. Bengali and
  -- Hindi pass `reviewed` today and fail this one. Collapsing them would make
  -- the owner's instruction unverifiable in exactly the languages where it is
  -- hardest to notice ⇒ trap_a_guard_satisfied_by_a_neighbouring_value.
  abuse_list_ready boolean not null default false,

  -- Whether the list ships in the code (src/lib/social/voiceGate.ts) rather
  -- than in social_abuse_terms. Only English does. ⚠️ Without this column the
  -- trigger that recomputes `abuse_list_ready` after a term is deleted would
  -- see zero rows for English and switch off every English schedule.
  abuse_list_builtin boolean not null default false,

  updated_at  timestamptz not null default now()
);

alter table social_language_tiers
  add column if not exists abuse_list_ready boolean not null default false;
alter table social_language_tiers
  add column if not exists abuse_list_builtin boolean not null default false;

-- ⚠️ These 22 codes and labels are the canonical set in
-- src/lib/connect/languages.ts, which is the list the backend already
-- validates against. ⛔ There is no Korean, and there IS Hebrew — I seeded
-- this from memory first and had both wrong. A guard below (the schedule
-- language trigger) rejects anything not in this table, so a drifted copy here
-- would silently make a real language unselectable.
-- ⛔ Only English has an abuse list. That is not an oversight and must not be
-- "fixed" by inventing lists for the other 21: in a language nobody here reads,
-- a wrong list is invisibly wrong AND reports success, which is strictly worse
-- than an absent one. It is the same shape as the Urdu and Kannada brand
-- spelling defects of 17 Oct — every file internally consistent, every check
-- green, the error only visible between files to somebody who reads the
-- language. ▶️ The remedy is a dozen words from a speaker, via
-- social_abuse_terms below, and no deploy.
insert into social_language_tiers (code, name, reviewed, abuse_list_ready, abuse_list_builtin) values
  ('en', 'English',    true,  true,  true),
  ('bn', 'Bengali',    true,  false, false),
  ('hi', 'Hindi',      true,  false, false),
  ('mr', 'Marathi', false, false, false),
  ('ta', 'Tamil', false, false, false),
  ('te', 'Telugu', false, false, false),
  ('gu', 'Gujarati', false, false, false),
  ('pa', 'Punjabi', false, false, false),
  ('kn', 'Kannada', false, false, false),
  ('ml', 'Malayalam', false, false, false),
  ('or', 'Odia', false, false, false),
  ('ur', 'Urdu', false, false, false),
  ('ar', 'Arabic', false, false, false),
  ('he', 'Hebrew', false, false, false),
  ('ru', 'Russian', false, false, false),
  ('zh', 'Chinese', false, false, false),
  ('ja', 'Japanese', false, false, false),
  ('es', 'Spanish', false, false, false),
  ('fr', 'French', false, false, false),
  ('de', 'German', false, false, false),
  ('pt', 'Portuguese', false, false, false),
  ('id', 'Indonesian', false, false, false)
on conflict (code) do nothing;

alter table social_language_tiers enable row level security;
-- No policies — admin API routes only (service_role); anon/authenticated deny.


-- ── 2. ACCOUNTS ──────────────────────────────────────────────────────────────
-- One row per connected channel. 🔴 THIS TABLE HOLDS CREDENTIALS.
--
-- `access_token` and `refresh_token` are stored ENCRYPTED by the application
-- before they ever reach here, so a leaked row is not a usable token. They are
-- never returned to a browser — the admin API sends `token_tail` and the
-- health fields, never the value.

create table if not exists social_accounts (
  id               uuid        primary key default gen_random_uuid(),
  platform         text        not null,
  display_name     text        not null,
  external_id      text        not null,
  access_token     text,                 -- encrypted at the application layer
  refresh_token    text,                 -- encrypted at the application layer
  token_tail       text,                 -- last 4 chars, for "is this the one I pasted?"
  token_expires_at timestamptz,          -- null = does not expire (a Meta system user)
  scopes           text[]      not null default '{}',
  status           text        not null default 'pending'
                     check (status in ('pending', 'ok', 'expiring', 'dead')),
  last_verified_at timestamptz,
  last_error       text,
  connected_by     uuid        references super_admins(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create unique index if not exists social_accounts_platform_external_idx
  on social_accounts (platform, external_id);

alter table social_accounts enable row level security;
-- No policies — admin API routes only. ⛔ Never relax this: these are tokens.


-- ── 3. SETTINGS ──────────────────────────────────────────────────────────────
-- Exactly one row. The master switch: one place to stop everything without
-- editing six schedules, for the week the estate is under scrutiny or any
-- other reason to stop quickly.

create table if not exists social_settings (
  id             int         primary key default 1 check (id = 1),
  posting_paused boolean     not null default false,
  paused_by      uuid        references super_admins(id) on delete set null,
  paused_at      timestamptz,
  note           text,
  updated_at     timestamptz not null default now()
);

insert into social_settings (id) values (1) on conflict (id) do nothing;

alter table social_settings enable row level security;


-- ── 4. SCHEDULES ─────────────────────────────────────────────────────────────
-- When something gets written, for which channels, in what shape, and in which
-- languages. `languages` is a LIST that rotates — each post is in exactly one.

create table if not exists social_schedules (
  id             uuid        primary key default gen_random_uuid(),
  name           text        not null,
  brief          text        not null,
  platforms      text[]      not null,
  content_type   text        not null
                   check (content_type in ('text', 'graphic', 'text_graphic', 'short_video')),
  topic_pool     text[]      not null default '{}',
  tone           text        not null default 'gentle_plain',
  length_hint    text        not null default 'short',

  -- ⛔ A schedule with no language is rejected, not defaulted to English.
  -- The constraint that does it is added below, by name — see 4a-bis.
  languages      text[]      not null,
  wordmark_follows_language boolean not null default true,

  post_at        time        not null,
  timezone       text        not null default 'Asia/Kolkata',
  days           int[]       not null,                                     -- 0=Sun … 6=Sat
  active         boolean     not null default true,

  -- The setting the owner asked for, in the position it starts in.
  -- FALSE: it writes, then waits in the review queue.
  -- TRUE:  it writes and posts, unattended.
  -- ⛔ The safety gate runs either way.
  auto_publish             boolean not null default false,
  auto_publish_enabled_by  uuid references super_admins(id) on delete set null,
  auto_publish_enabled_at  timestamptz,

  created_by     uuid        references super_admins(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- ── 4a-bis. THE EMPTY-ARRAY TRAP ─────────────────────────────────────────────
--
-- 🔴 THIS WAS WRONG IN PRODUCTION, AND I ONLY FOUND IT BY RUNNING IT. The three
-- constraints above originally read `check (array_length(languages, 1) >= 1)`,
-- which looks exactly right and does nothing:
--
--     array_length('{}', 1)  →  NULL     -- not 0
--     NULL >= 1              →  NULL
--     a CHECK constraint rejects only FALSE, so NULL PASSES.
--
-- ⇒ A schedule with NO LANGUAGE AT ALL was accepted — status 201 — and the one
-- invariant this migration's own header calls out as deliberate was inert.
--
-- ⚠️ AND NO TEST COULD HAVE CAUGHT IT. The static guard asserted the constraint
-- text was present, and it was. The API route rejects an empty list too, and
-- does. The hole was only ever reachable by a writer that is not that route —
-- which is the entire reason the constraint exists.
--
-- ✅ `cardinality()` returns 0 for an empty array, so the comparison is a real
-- boolean. ⛔ Never `array_length` for an is-it-empty check.
--
-- Named and dropped-first so re-running this file repairs an existing table.

alter table social_schedules drop constraint if exists social_schedules_platforms_check;
alter table social_schedules drop constraint if exists social_schedules_languages_check;
alter table social_schedules drop constraint if exists social_schedules_days_check;
alter table social_schedules drop constraint if exists social_schedules_platforms_not_empty;
alter table social_schedules drop constraint if exists social_schedules_languages_not_empty;
alter table social_schedules drop constraint if exists social_schedules_days_not_empty;

alter table social_schedules
  add constraint social_schedules_platforms_not_empty check (cardinality(platforms) >= 1);
alter table social_schedules
  add constraint social_schedules_languages_not_empty check (cardinality(languages) >= 1);
alter table social_schedules
  add constraint social_schedules_days_not_empty      check (cardinality(days) >= 1);


create index if not exists social_schedules_active_idx
  on social_schedules (active, post_at);

alter table social_schedules enable row level security;


-- ── 4a. THE TRIGGER THAT MAKES THE LANGUAGE RULE REAL ────────────────────────
-- A schedule may not auto-publish in a language nobody here reads.
--
-- 🔑 Why a trigger and not a check in the API route: the route is one writer.
-- This invariant has to hold for every writer there will ever be — a second
-- route added next year, a repair script, a hand-typed UPDATE. A guard that
-- lives in one caller is a guard that one caller can forget.

create or replace function social_schedule_language_guard()
returns trigger
language plpgsql
as $$
declare
  unreviewed text[];
  unguarded  text[];
  unknown    text[];
begin
  -- Every language must be one of the 22 we actually support.
  select array_agg(l)
    into unknown
    from unnest(new.languages) as l
   where not exists (select 1 from social_language_tiers t where t.code = l);

  if unknown is not null then
    raise exception
      'social_schedules: unknown language code(s) %. Known codes live in social_language_tiers.',
      array_to_string(unknown, ', ')
      using errcode = '23514';
  end if;

  -- And a schedule may only post unattended in languages somebody here reads.
  if new.auto_publish then
    -- Condition one: somebody here can read it.
    select array_agg(l)
      into unreviewed
      from unnest(new.languages) as l
     where exists (select 1 from social_language_tiers t where t.code = l and not t.reviewed);

    if unreviewed is not null then
      raise exception
        'social_schedules: auto_publish cannot be enabled while this schedule writes in %, which nobody here reads yet. Drafts in those languages queue for a human. Mark the language reviewed in social_language_tiers once a speaker has read real drafts.',
        array_to_string(unreviewed, ', ')
        using errcode = '23514';
    end if;

    -- Condition two, and SEPARATE: there is something to check abuse against.
    select array_agg(l)
      into unguarded
      from unnest(new.languages) as l
     where exists (select 1 from social_language_tiers t where t.code = l and not t.abuse_list_ready);

    if unguarded is not null then
      raise exception
        'social_schedules: auto_publish cannot be enabled while this schedule writes in %, because there is no abuse-and-profanity list for %. The posts could not be checked for the thing the owner asked about. Add terms to social_abuse_terms and the flag follows.',
        array_to_string(unguarded, ', '), array_to_string(unguarded, ', ')
        using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists social_schedules_language_guard on social_schedules;
create trigger social_schedules_language_guard
  before insert or update on social_schedules
  for each row execute function social_schedule_language_guard();


-- ── 4b. THE ABUSE LISTS A SPEAKER CONTRIBUTES ────────────────────────────────
-- The owner's instruction, 17 Oct: ship English and let "the speaker can
-- enhance this later". ⇒ So contributing is an INSERT, not a deploy. The day
-- somebody who speaks Bengali is willing to spend ten minutes on this is not
-- the day to be waiting on a release.
--
-- ⚠️ Both the native script AND the Latin transliteration belong here. Abuse in
-- Indic languages is written in Latin letters at least as often as in its own
-- script, and a list holding only one form checks only half the posts.

create table if not exists social_abuse_terms (
  id             uuid        primary key default gen_random_uuid(),
  language       text        not null references social_language_tiers(code),
  term           text        not null check (btrim(term) <> ''),
  script         text        check (script in ('native', 'latin')),
  contributed_by text,
  note           text,
  created_at     timestamptz not null default now()
);

create unique index if not exists social_abuse_terms_lang_term_idx
  on social_abuse_terms (language, lower(btrim(term)));

alter table social_abuse_terms enable row level security;


-- `abuse_list_ready` is DERIVED, never set by hand.
--
-- 🔑 A flag maintained by whichever API route remembered to is a flag that goes
-- stale, and this one gates unattended publishing. ⇒ It is recomputed from the
-- facts every time either fact changes.
create or replace function social_recompute_abuse_ready(p_language text)
returns void
language plpgsql
as $$
begin
  update social_language_tiers t
     set abuse_list_ready =
           t.abuse_list_builtin
           or exists (select 1 from social_abuse_terms a where a.language = t.code),
         updated_at = now()
   where t.code = p_language;
end;
$$;

create or replace function social_abuse_terms_touch()
returns trigger
language plpgsql
as $$
begin
  perform social_recompute_abuse_ready(coalesce(new.language, old.language));
  return coalesce(new, old);
end;
$$;

drop trigger if exists social_abuse_terms_touch on social_abuse_terms;
create trigger social_abuse_terms_touch
  after insert or update or delete on social_abuse_terms
  for each row execute function social_abuse_terms_touch();


-- ── 4c. DEMOTING A LANGUAGE MUST STOP THE SCHEDULES ALREADY USING IT ─────────
--
-- 🔴 THE HOLE THIS CLOSES. The guard on social_schedules runs when a SCHEDULE
-- is written. It cannot see a language being demoted afterwards — a speaker
-- reading drafts and saying "no, this is not right", or the last abuse term
-- being deleted. The schedule would carry on posting unattended in a language
-- that no longer qualifies, and every check would still be green.
--
-- ⚠️ IT TURNS AUTO-PUBLISH OFF RATHER THAN REFUSING THE DEMOTION. Refusing
-- would mean the only way to withdraw a language is to find and edit every
-- schedule first — so the safe act would be the hard one, and in a hurry
-- somebody would skip it. Posts keep being written and queued; they simply wait
-- for a person again.

create or replace function social_language_demotion_guard()
returns trigger
language plpgsql
as $$
begin
  if (old.reviewed and not new.reviewed)
     or (old.abuse_list_ready and not new.abuse_list_ready) then
    update social_schedules
       set auto_publish = false,
           auto_publish_enabled_by = null,
           auto_publish_enabled_at = null,
           updated_at = now()
     where auto_publish
       and new.code = any (languages);
  end if;
  return new;
end;
$$;

drop trigger if exists social_language_demotion_guard on social_language_tiers;
create trigger social_language_demotion_guard
  after update on social_language_tiers
  for each row execute function social_language_demotion_guard();


-- ── 5. POSTS ─────────────────────────────────────────────────────────────────
-- One row per post per platform. A HAND-WRITTEN POST IS A FIRST-CLASS ROW,
-- not a special case: `origin` says where it came from and nothing else in the
-- pipeline branches on it. Same gate, same composer, same adapter.

create table if not exists social_posts (
  id               uuid        primary key default gen_random_uuid(),

  origin           text        not null check (origin in ('generated', 'written')),
  schedule_id      uuid        references social_schedules(id) on delete set null,
  author_id        uuid        references super_admins(id) on delete set null,

  platform         text        not null,
  language         text        not null references social_language_tiers(code),

  scheduled_for    timestamptz,          -- null = post as soon as it is approved
  status           text        not null default 'drafting'
                     check (status in ('drafting', 'generating', 'needs_review', 'approved',
                                       'publishing', 'published', 'failed', 'skipped',
                                       'rejected_by_gate')),

  subject          text,
  body             text,
  media_kind       text        check (media_kind in ('none', 'graphic', 'short_video')),
  media_path       text,
  visual_recipe    jsonb,

  gate_result      jsonb,                -- which lists ran, and what they found
  reviewed_by      uuid        references super_admins(id) on delete set null,
  reviewed_at      timestamptz,
  external_post_id text,
  attempts         int         not null default 0,
  last_error       text,
  generated_at     timestamptz,
  published_at     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  -- A generated post belongs to a schedule; a written one has an author.
  -- ⛔ Neither may be anonymous: every published word has somebody's name on it.
  constraint social_posts_origin_provenance check (
    (origin = 'generated' and schedule_id is not null) or
    (origin = 'written'   and author_id   is not null)
  )
);

create index if not exists social_posts_status_idx
  on social_posts (status, scheduled_for);
create index if not exists social_posts_schedule_idx
  on social_posts (schedule_id, created_at desc);

alter table social_posts enable row level security;


-- ── 5a. THE CHANNELS, AS A RE-RUNNABLE CONSTRAINT ───────────────────────────
--
-- ⚠️ Named and dropped-first, so adding a channel is a re-run of this file
-- rather than a hand-typed ALTER somebody has to remember. The original
-- constraints were inline and auto-named, which is why both are dropped here.
--
-- ⛔ A channel being LISTED here does not mean it can publish. Every one of
-- them is blocked on something different, and src/lib/social/platforms.ts says
-- what, per channel. Collapsing those reasons into "coming soon" would hide
-- that LinkedIn is waiting on LinkedIn while Facebook is waiting on fifteen
-- minutes in a portfolio.

alter table social_accounts drop constraint if exists social_accounts_platform_check;
alter table social_accounts drop constraint if exists social_accounts_platform_known;
alter table social_accounts
  add constraint social_accounts_platform_known
  check (platform in ('facebook', 'linkedin', 'instagram', 'x', 'youtube'));

alter table social_posts drop constraint if exists social_posts_platform_check;
alter table social_posts drop constraint if exists social_posts_platform_known;
alter table social_posts
  add constraint social_posts_platform_known
  check (platform in ('facebook', 'linkedin', 'instagram', 'x', 'youtube'));


-- ── 6. THE SUBJECT REGISTER ──────────────────────────────────────────────────
-- What makes "always unique" true rather than requested. Globally unique, so a
-- hand-written subject also stops a generated post reusing it, and vice versa.

create table if not exists social_topics_used (
  id           uuid        primary key default gen_random_uuid(),
  subject_hash text        not null,
  subject      text        not null,
  language     text        references social_language_tiers(code),
  schedule_id  uuid        references social_schedules(id) on delete set null,
  post_id      uuid        references social_posts(id) on delete set null,
  used_at      timestamptz not null default now()
);

create unique index if not exists social_topics_used_hash_idx
  on social_topics_used (subject_hash);
create index if not exists social_topics_used_recent_idx
  on social_topics_used (used_at desc);

alter table social_topics_used enable row level security;


-- ── 7. THE VISUAL REGISTER ───────────────────────────────────────────────────
-- The same discipline applied to the PICTURE. A recipe is the combination of
-- layout, palette, type treatment, motif and the script of the wordmark. The
-- combination is hashed and may never come round again; separately, no palette
-- and no layout returns inside 14 days, so the feed does not merely LOOK
-- repetitive while every hash is technically distinct.

create table if not exists social_visuals_used (
  id             uuid        primary key default gen_random_uuid(),
  recipe_hash    text        not null,
  layout         text        not null,
  palette        text        not null,
  type_treatment text        not null,
  motif          text        not null,
  script         text        not null,
  schedule_id    uuid        references social_schedules(id) on delete set null,
  post_id        uuid        references social_posts(id) on delete set null,
  used_at        timestamptz not null default now()
);

create unique index if not exists social_visuals_used_hash_idx
  on social_visuals_used (recipe_hash);
create index if not exists social_visuals_used_recent_idx
  on social_visuals_used (used_at desc);
create index if not exists social_visuals_used_palette_idx
  on social_visuals_used (palette, used_at desc);
create index if not exists social_visuals_used_layout_idx
  on social_visuals_used (layout, used_at desc);

alter table social_visuals_used enable row level security;


-- ── 8. WHAT THIS MIGRATION DELIBERATELY DOES NOT CREATE ──────────────────────
-- No policies on any table above. No `grant` to anon or authenticated. If a
-- future change needs a client to read one of these tables directly, that is
-- the moment to stop and write an API route instead — ⛔ social_accounts holds
-- tokens, and the July 2026 failure was exactly a table the anon key could
-- read because a policy was added to make a page work.
-- ============================================================
