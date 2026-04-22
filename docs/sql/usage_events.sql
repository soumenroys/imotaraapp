-- Run in Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- LIC-1: Usage tracking table for per-user cloud reply quota enforcement

create table if not exists usage_events (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null,
  event_type  text not null default 'chat_reply',
  created_at  timestamptz not null default now()
);

-- Fast daily quota check: filter by user_id + date range
create index if not exists usage_events_user_day_idx
  on usage_events (user_id, created_at desc);

-- Row-level security
alter table usage_events enable row level security;

-- Users can read their own events (for future usage dashboards)
create policy "Users read own usage"
  on usage_events for select
  using (auth.uid() = user_id);

-- No client-side inserts — the service-role API route handles all writes
