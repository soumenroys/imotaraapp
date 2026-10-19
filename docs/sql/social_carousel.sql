-- docs/sql/social_carousel.sql
--
-- 🔑 CAROUSELS. Several cards on one post, swiped.
--
-- ⚠️ WHY THIS IS A NEW SHAPE AND NOT A RENDERING OPTION. Our posts run two or
-- three sentences; splitting those across slides is padding — the "swipe for
-- the obvious conclusion" shape readers recognise and resent. A carousel needs
-- writing that earns each swipe, which is a different kind of writing. It has
-- its own pool (`ways-of-saying`) and needs its own schedule, because the
-- existing brief asks for a product capability and that instruction cannot
-- coexist with "list five ways a feeling shows up" — measured, 3/3 drafts
-- ⇒ feedback_social_content_standing_rules.
--
-- ⛔ RE-RUNNABLE. Every statement is IF NOT EXISTS or a dropped-and-recreated
-- named constraint.

-- ── 1. THE SLIDES ────────────────────────────────────────────────────────────
--
-- 🔑 An ARRAY OF LINES, written as slides rather than cut out of the body.
-- ⛔ Deriving them by splitting `body` on sentence ends was the first design
-- and it is fragile in exactly the way that matters: an abbreviation, a
-- decimal or a quoted full stop silently changes how many cards publish.
--
-- ⚠️ NULL for every non-carousel post, and that is the normal case.
alter table social_posts add column if not exists slides jsonb;

comment on column social_posts.slides is
  'Carousel slide lines, in order, as a JSON array of strings. The post''s subject is the FIRST '
  'card; these follow it. NULL for every other shape. ⛔ Never derived by splitting body.';

-- ── 2. THE TWO CHECK CONSTRAINTS ─────────────────────────────────────────────
--
-- 🔴 THE FIVE-COPIES PROBLEM, named in src/lib/social/contentTypes.ts: this
-- list exists in a TypeScript const, a form, two routes and here. The copy
-- that gets missed is the one that cannot import the others — this one. When
-- `short_video` and `animated_gif` were added, four of five were updated.
alter table social_schedules drop constraint if exists social_schedules_content_type_check;
alter table social_schedules add constraint social_schedules_content_type_check
  check (content_type in ('text', 'graphic', 'text_graphic', 'animated_gif', 'short_video', 'carousel'));

alter table social_posts drop constraint if exists social_posts_media_kind_check;
alter table social_posts add constraint social_posts_media_kind_check
  check (media_kind in ('none', 'graphic', 'animated_gif', 'short_video', 'carousel'));
