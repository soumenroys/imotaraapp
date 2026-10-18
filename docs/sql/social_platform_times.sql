-- docs/sql/social_platform_times.sql
--
-- 🔑 THE OWNER, 18 Oct: "I want every social media schedule can be customized
-- in different date and time. Create that and set the schedule 30 minutes
-- earlier than Facebook everyday."
--
-- 🔴 WHY THE ROW'S ONE `post_at` WAS NOT ENOUGH. A schedule carries a list of
-- platforms and ONE time, so every channel on it fired at the same minute.
-- That is the scheduling half of the same mistake the content rules already
-- forbid: one post text pushed to five channels. Channels differ in when
-- their readers are there as much as in how they read.
--
-- ⚠️ AN OVERRIDE, NOT A REPLACEMENT. `post_at` and `days` remain the
-- schedule's default and still answer for any platform not named here. ⛔ A
-- migration that moved every time into the json would have made the simple
-- case — one channel, one time — harder to read and easier to get wrong.
--
--   {"instagram": {"post_at": "17:00:00"}}
--   {"instagram": {"post_at": "17:00:00", "days": [1,2,3,4,5]}}
--
-- 🔑 `days` is optional INSIDE each entry too, so "same days, different hour"
-- — which is this first case — does not have to restate the week.
--
-- ⛔ RE-RUNNABLE.
alter table social_schedules add column if not exists platform_times jsonb;

comment on column social_schedules.platform_times is
  'Per-platform overrides of post_at/days. Shape: {"instagram":{"post_at":"17:00:00","days":[0,1,2,3,4,5,6]}}. '
  'Absent platform = use the row''s own post_at and days. ⛔ Never a partial time string; always HH:MM:SS.';
