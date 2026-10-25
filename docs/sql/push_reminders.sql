-- docs/sql/push_reminders.sql
-- Web daily check-in: the browser push subscription and the person's reminder
-- choices, in a table of their own.
--
-- 🔴 WHY (25 Oct 2026): these used to live in public.user_memory as
-- {type:'push', confidence:1}. The live constraints reject both, so NOT ONE
-- subscription was ever saved and the web check-in never reached anyone. And
-- user_memory is loaded WHOLE into the AI's context (fetchUserMemories selects
-- every row): a push endpoint and its keys do not belong where Imotara reads.
--
-- ⛔ Server only: RLS on with NO policies, so anon/authenticated can read or
--    write nothing; the API routes use the service role.
-- ⛔ From 30 Oct 2026 a new public table needs explicit GRANTs or the API says
--    "permission denied" — they are in this file on purpose.
-- Idempotent: safe to run twice.

create table if not exists public.push_reminders (
  user_id           uuid primary key references auth.users (id) on delete cascade,
  subscription      jsonb,                         -- null when the browser unsubscribed or the push service said gone
  last_notified_at  timestamptz,
  snoozed_until     timestamptz,                   -- Free: 3 or 5 days (lib/reminders/snooze.ts)
  disabled          boolean not null default false, -- Plus: off for good
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

alter table public.push_reminders enable row level security;

revoke all on public.push_reminders from anon, authenticated;
grant select, insert, update, delete on public.push_reminders to service_role;

comment on table public.push_reminders is
  'Web daily check-in: push subscription + snooze/disable. Server-only (service role). Never in user_memory, which the AI reads.';
