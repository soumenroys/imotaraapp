-- docs/sql/social_instagram_stats.sql
--
-- 🔑 WHY INSTAGRAM NEEDED COLUMNS AND FACEBOOK DID NOT. The tables were shaped
-- around what a Facebook Page reports: reactions, comments, shares. Instagram
-- ranks on something else entirely — SAVES and shares far more than likes —
-- and the post voice in platforms.ts is written for exactly that.
--
-- ⛔ A metric we optimise for and do not record is a claim nobody can check.
-- Without `saves` the dashboard could show that the Instagram posts got likes
-- and never whether the thing we actually changed the writing for worked.
--
-- ⚠️ EVERY COLUMN IS NULLABLE AND MEANS "we could not ask" WHEN NULL. ⛔ Never
-- 0: a zero is a measurement, and a column of invented zeros averages into
-- every chart as if somebody had looked.
--
-- ⛔ RE-RUNNABLE. Every statement is IF NOT EXISTS.

-- ── 1. WHAT A POST DID, IN INSTAGRAM'S TERMS ─────────────────────────────────
--
-- 🔑 `saves` is the headline number for this channel. It is the closest thing
-- any of these platforms has to "somebody wanted to keep this".
alter table social_post_stats add column if not exists saves int;

-- Distinct people, as opposed to times shown. Facebook reports this per Page;
-- Instagram reports it per post as well, which is more useful.
alter table social_post_stats add column if not exists reach int;

-- ── 2. THE CHANNEL, DAY BY DAY ───────────────────────────────────────────────
--
-- ⚠️ SIGNED, AND THAT IS THE POINT. Instagram reports net new followers for a
-- day and the number can be NEGATIVE. Storing it unsigned, or clamping it at
-- zero, would turn "eleven people left" into "a quiet day" — which is the one
-- reading this table exists to prevent.
alter table social_channel_stats add column if not exists follower_change int;
