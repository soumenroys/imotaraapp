-- Run in Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- LIC-3: Add token_balance to the licenses table

-- token_balance: prepaid cloud reply credits (topped up via one-time purchases)
alter table licenses
  add column if not exists token_balance integer not null default 0;

-- valid_until: expiry date for time-boxed tiers (plus/pro subscriptions)
-- NULL means no expiry (free tier or lifetime)
alter table licenses
  add column if not exists valid_until timestamptz;

-- Index for efficient tier + expiry queries
create index if not exists licenses_user_tier_idx
  on licenses (user_id, tier);
