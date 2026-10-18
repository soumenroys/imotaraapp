-- docs/sql/cron_heartbeats.sql
--
-- 🔴 A CRON THAT DIES FAILS WHERE NOBODY IS WATCHING.
--
-- Vercel's runtime logs returned NOTHING for a 45-minute window — including
-- for broadcast-queue and social-queue, which run every minute and
-- demonstrably work. So the logs are a retention setting, not evidence. There
-- was no way, from inside the product, to answer "did that job run?"
--
-- This repo has already been bitten: two of seven crons were declared as GET
-- in vercel.json and written as POST, and answered 405 for MONTHS without one
-- person noticing, because a dead cron produces exactly as much output as a
-- healthy one with nothing to do — none.
--
-- ⇒ Each job writes one row when it fires. The admin panel reads it and says
-- how long ago that was. It does not depend on a log retention window, a
-- plan tier, or anybody remembering to look at a dashboard.
--
-- ⛔ One row per job, overwritten — not an append-only log. The question is
-- "is this alive", not "what did it do in March", and a table that grows by
-- 1,440 rows a day per minute-cron would need its own retention policy.

create table if not exists cron_heartbeats (
  job          text        primary key,
  last_fired_at timestamptz not null,
  -- ⚠️ Counts since the row was created. Not reset, so a job whose count stops
  -- climbing is as visible as one whose timestamp stops moving.
  fire_count   bigint      not null default 1,
  -- Whatever the job wants to say about its last run. Free text, read by a
  -- person, never parsed.
  last_note    text
);

comment on table cron_heartbeats is
  'One row per scheduled job, overwritten on each run. Answers "is this alive?" without depending on log retention.';

-- RLS on with no policies: the service role bypasses it, everybody else gets
-- nothing. Same posture as the social tables.
alter table cron_heartbeats enable row level security;

-- ── The write the crons make ──────────────────────────────────────────
--
-- ⚠️ One statement, so two overlapping runs cannot lose a count between a
-- read and a write. `fire_count + 1` is evaluated by the database.
create or replace function bump_cron_heartbeat(p_job text, p_note text default null)
returns void
language sql
security definer
set search_path = public
as $$
  insert into cron_heartbeats (job, last_fired_at, fire_count, last_note)
  values (p_job, now(), 1, p_note)
  on conflict (job) do update
  set last_fired_at = now(),
      fire_count    = cron_heartbeats.fire_count + 1,
      last_note     = excluded.last_note;
$$;

-- ── Read it like the admin panel does ───────────────────────────────────────
select job,
       last_fired_at,
       fire_count,
       round(extract(epoch from (now() - last_fired_at)) / 60)::int as minutes_ago,
       last_note
from   cron_heartbeats
order  by last_fired_at;
