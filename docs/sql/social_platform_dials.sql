-- docs/sql/social_platform_dials.sql
-- The per-channel editorial dials, where they can be TUNED without a deploy.
--
-- 🔑 WHY THIS TABLE EXISTS. The owner asked on 19 Oct whether per-platform
-- rules, feedback and policies live in the database "for continual fine
-- tuning". They did not: every one of them was a literal in platforms.ts, so
-- acting on a measurement meant editing TypeScript and shipping a build. A
-- number that can only be changed by a deploy is a number nobody changes.
--
-- ⛔ AND WHY ONLY *THESE* FIELDS. `PlatformSpec` holds two different kinds of
-- thing, and the distinction is the whole safety argument:
--
--   • PLATFORM FACTS — the 2,200-character Instagram ceiling, "Instagram has
--     no text-only post", "a link in a Facebook body costs the post its
--     distribution", the picture dimensions. These are not opinions and they
--     are not ours. A row claiming Instagram accepts a text-only post would
--     silently stop that channel publishing and look exactly like a channel
--     nobody scheduled ⇒ trap_a_dead_cron_fails_where_nobody_is_watching.
--     THEY STAY IN CODE, where changing one is a reviewed diff.
--
--   • EDITORIAL DIALS — how long a post should be here, how many tags are
--     normal, how many emoji, whether tags are how a stranger arrives. Every
--     one of these is a judgement that the statistics can argue with, which
--     is precisely what makes it worth tuning and safe to tune.
--
-- ⚠️ SEEDED WITH THE VALUES THAT ARE IN THE CODE TODAY, so applying this file
-- changes nothing about what gets written. That is deliberate: a migration
-- that also changes behaviour gives you two things to debug at once.
--
-- 🔴 AND THE LIMIT OF WHAT THIS BUYS. Editing a row changes what is written
-- NEXT. It does not touch the ten days of posts already sitting in the review
-- queue, which were written under the old numbers and will publish under them
-- ⇒ trap_a_frozen_decision_outlives_its_rule. Six queued posts stayed cardless
-- once already for exactly this reason. ▶️ After a change worth having, read
-- the queue and decide whether to re-write it.

create table if not exists social_platform_dials (
  -- ⚠️ The platform id as the code spells it ⇒ PLATFORM_IDS. Not a foreign key
  -- to anything: the list of channels is code, and a row for a channel that no
  -- longer exists is ignored rather than an error.
  platform text primary key,

  /**
   * How long a post should be here — a FLOOR as well as a ceiling.
   *
   * 🔴 THE FLOOR IS THE POINT. Measured 19 Oct: 23 of 30 posts were exactly
   * two sentences, Facebook's median 163 characters against a 500-character
   * fold. Nothing in the system could notice a post was too SHORT, because
   * the only number it had was "do not exceed".
   */
  body_min integer not null,
  body_max integer not null,

  /** ⚠️ Not a licence — fewer is still better. A ceiling, not a target. */
  hashtags integer not null,
  emoji integer not null,

  /**
   * 🔑 Is a post with no tags a missed opportunity HERE?
   *
   * ⛔ A different question from "how many are allowed". LinkedIn permits
   * three and a good LinkedIn post often has none; on Instagram tags are
   * close to the only way a stranger ever arrives. Saying "you used none of
   * your tags" on Facebook, whose right answer is zero, is advice to do the
   * wrong thing.
   */
  tags_drive_discovery boolean not null,

  -- 🔑 WHY it was set here. ⛔ Not decoration: a dial with no reason attached
  -- gets reverted by the next person who disagrees with it, including me.
  note text,

  updated_at timestamptz not null default now(),
  updated_by text
);

comment on table social_platform_dials is
  'Per-channel EDITORIAL dials, tunable without a deploy. Platform FACTS '
  '(hard limits, requiresPicture, linksInBody, picture size) stay in '
  'src/lib/social/platforms.ts on purpose — a wrong value there stops a '
  'channel publishing. The loader falls back to the code values on any error '
  'and rejects an out-of-range row ⇒ src/lib/social/platformDials.ts.';

/**
 * ⛔ RANGE CHECKS IN THE TABLE, NOT ONLY IN THE LOADER.
 *
 * 🔴 These dials are read into a PROMPT. A row saying `hashtags = 400` does
 * not throw anything — it instructs the writer to produce 400 hashtags, and
 * the gate, which reads its ceiling from the same row, agrees that is fine.
 * Both halves of the check move together, so nothing catches it
 * ⇒ trap_a_guard_satisfied_by_a_neighbouring_value.
 *
 * ⚠️ The loader validates too, because a direct SQL update is not the only
 * way a bad value arrives. Two gates for one rule is right here: this one
 * stops the row existing, that one stops a surviving row being used.
 */
alter table social_platform_dials
  drop constraint if exists social_platform_dials_sane;
alter table social_platform_dials
  add constraint social_platform_dials_sane check (
    body_min >= 40 and body_min <= 2000
    and body_max > body_min and body_max <= 3000
    and hashtags >= 0 and hashtags <= 10
    and emoji >= 0 and emoji <= 5
  );

-- 🔒 Service role only, like every other table in this feature.
alter table social_platform_dials enable row level security;

drop policy if exists social_platform_dials_service on social_platform_dials;
create policy social_platform_dials_service on social_platform_dials
  for all to service_role using (true) with check (true);

-- ── The values that are in the code today, and nothing else ─────────────────
--
-- ⚠️ `on conflict do nothing`: re-running this file must never undo a dial
-- somebody has since tuned. That is the whole purpose of the table.
insert into social_platform_dials
  (platform, body_min, body_max, hashtags, emoji, tags_drive_discovery, note, updated_by)
values
  ('facebook',  320, 460, 0, 1, false,
   'Fold at 500 characters, so there is real room before "see more". Tags do nothing here and read as advertising.',
   'seed'),
  ('linkedin',  140, 210, 3, 1, false,
   'Fold at ~210. Three tags are permitted and a good post often has none.',
   'seed'),
  ('instagram', 120, 200, 5, 2, true,
   'Fold at 125 — everything after it is behind "see more", so the target stays short. Tags are close to the only way a stranger arrives on an account this size.',
   'seed'),
  ('x',         150, 270, 1, 1, false,
   '280 hard, so the ceiling IS the platform. One tag at most.',
   'seed'),
  ('youtube',   180, 290, 0, 1, false,
   'A community post. Tags are not how anyone finds these.',
   'seed')
on conflict (platform) do nothing;
