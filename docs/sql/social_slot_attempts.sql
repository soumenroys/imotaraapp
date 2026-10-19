-- docs/sql/social_slot_attempts.sql
-- Why a slot in the ten-day horizon is still empty.
--
-- 🔴 THE PROBLEM THIS SOLVES, FOUND BEFORE DEPLOYING AND NOT AFTER.
--
-- The queue now fills the next ten days rather than one slot two hours out.
-- It takes the EARLIEST missing slots, a bounded number per run, every minute.
-- A slot that cannot be filled — a duplicate subject, a model outage, no
-- unused recipe left — is therefore retried EVERY MINUTE, FOREVER:
--
--   · about 2,880 model calls a day, for a post that is never written;
--   · and because the earliest are taken first, that one slot blocks every
--     slot behind it. Ten days of queue would stay empty behind one bad day,
--     and the only symptom is an empty review screen.
--
-- ⇒ So each attempt is recorded, and a slot that has just failed is left alone
-- for a while. ⛔ The back-off is NOT silence: `last_error` is what the admin
-- screen shows beside an empty slot, so "nothing was written for Tuesday" has
-- a reason a human can read instead of being a gap nobody can explain.

create table if not exists social_slot_attempts (
  schedule_id      uuid        not null references social_schedules(id) on delete cascade,
  platform         text        not null,
  scheduled_for    timestamptz not null,

  attempts         int         not null default 0,
  last_attempt_at  timestamptz not null default now(),
  -- ⚠️ The reason in the words the generator used. A code would need a lookup
  -- table that drifts; this is read by a person, once, when they wonder.
  last_error       text,

  primary key (schedule_id, platform, scheduled_for)
);

-- The query the cron makes: every recent attempt for these schedules.
create index if not exists social_slot_attempts_lookup
  on social_slot_attempts (schedule_id, scheduled_for);

-- 🔒 Service role only, like every other table in this feature. Nothing here
-- is reachable by a signed-in user, and there is no reason it ever should be.
alter table social_slot_attempts enable row level security;

drop policy if exists "service role only" on social_slot_attempts;
create policy "service role only" on social_slot_attempts
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
