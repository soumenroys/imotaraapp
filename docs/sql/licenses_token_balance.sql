-- Run in Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- LIC-3: Create the licenses table (does not exist yet in production)
-- Columns match what the existing code in /api/license/status/route.ts already expects.

create table if not exists licenses (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,

  -- Tier: free | plus | pro | family
  tier           text not null default 'free',

  -- Status: valid | invalid | expired | trial
  status         text not null default 'valid',

  -- Expiry — NULL means no expiry (free tier or lifetime grant)
  -- Named expires_at to match the existing API code (.select("tier,status,expires_at"))
  expires_at     timestamptz,

  -- LIC-3: prepaid cloud reply credits (topped up via one-time token pack purchases)
  -- Plus/Pro users bypass this; token-pack users are decremented per cloud reply
  token_balance  integer not null default 0,

  -- Payment traceability
  source         text,       -- 'manual' | 'razorpay' | 'stripe' | 'promo' | 'internal'
  external_ref   text,       -- Razorpay order ID / Stripe subscription ID
  notes          text,

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- One license row per user
create unique index if not exists licenses_user_id_idx
  on licenses (user_id);

-- Fast tier + expiry queries (for quota gate in LIC-2)
create index if not exists licenses_user_tier_idx
  on licenses (user_id, tier);

-- Row-level security
alter table licenses enable row level security;

-- Users can read their own license row
create policy "Users read own license"
  on licenses for select
  using (auth.uid() = user_id);

-- No client-side writes — all mutations go through service-role API routes
