-- Run in Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- ANALYTICS-1: record WHICH surface an event came from.
--
-- usage_events already records user_id, event_type, emotion and created_at.
-- What it has never recorded is whether the event came from the website or
-- from the phone app — so "how is the mobile app doing versus the web app"
-- was unanswerable from our own data, which is the question that sent us
-- looking at third-party analytics in the first place.
--
-- This adds no new information about a PERSON. It is one of four fixed
-- strings describing the software, attached to a row we already write. It
-- introduces no SDK, no cookie, no device identifier, and nothing leaves our
-- own database — so the "no third-party tracking / no analytics SDK" position
-- in PLAY_DATA_SAFETY.md, the help centre and the store listings stays true
-- exactly as written. Do not let this become a device-fingerprint column.

alter table usage_events
  add column if not exists platform text;   -- 'web' | 'ios' | 'android' | 'unknown'

-- Only these four values, so a typo in a route cannot quietly create a fifth
-- surface that then splits the numbers.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'usage_events_platform_check'
  ) then
    alter table usage_events
      add constraint usage_events_platform_check
      check (platform is null or platform in ('web','ios','android','unknown'));
  end if;
end $$;

-- The analytics page slices by day, then by platform and event_type. Existing
-- index is (user_id, created_at desc) and serves the per-user quota check;
-- this one serves the date-range scan that the dashboard does.
create index if not exists usage_events_created_platform_idx
  on usage_events (created_at desc, platform);

-- Rows written before this migration keep platform = null and render as
-- "unknown" in the dashboard. They are NOT backfilled with a guess: pretending
-- to know where six months of historical events came from would put invented
-- data in front of a decision.
