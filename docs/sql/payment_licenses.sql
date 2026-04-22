-- docs/sql/payment_licenses.sql
-- LIC-5: Audit table — one row per Razorpay payment that resulted in a license grant.
-- Run once in Supabase SQL Editor.

create table if not exists payment_licenses (
    payment_id   text        primary key,                              -- Razorpay payment_id
    user_id      uuid        references auth.users(id) on delete cascade,
    product_id   text,                                                  -- e.g. "plus_monthly"
    chat_link_key text,                                                 -- legacy field (keep for compat)
    tier         text        not null default 'free',                   -- resulting tier
    amount_paise integer,
    currency     text        not null default 'INR',
    granted_at   timestamptz not null default now()
);

create index if not exists payment_licenses_user_idx on payment_licenses (user_id);

alter table payment_licenses enable row level security;
create policy "Users read own payment licenses"
    on payment_licenses for select using (auth.uid() = user_id);
