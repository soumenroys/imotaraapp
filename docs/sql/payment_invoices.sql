-- ============================================================
-- docs/sql/payment_invoices.sql
-- Invoice/receipt system — one row per payment event.
-- Auto-generated on every successful payment (Razorpay, Apple IAP, Google Play, Stripe).
-- Run in Supabase SQL Editor.
-- ============================================================

create sequence if not exists invoice_number_seq start 1000 increment 1;

create table if not exists payment_invoices (
  id              uuid        primary key default gen_random_uuid(),
  invoice_number  text        not null unique default ('INV-' || lpad(nextval('invoice_number_seq')::text, 6, '0')),

  -- Who paid
  user_id         uuid        not null references auth.users(id) on delete cascade,
  org_id          uuid        references organizations(id) on delete set null,

  -- What was paid for
  product_id      text        not null,        -- e.g. 'plus_monthly', 'pro_annual', 'tokens_600'
  tier            text,                         -- resulting license tier
  description     text        not null,         -- human-readable e.g. "Imotara Plus · Monthly"

  -- Payment details
  payment_gateway text        not null,         -- 'razorpay' | 'apple' | 'google_play' | 'stripe'
  gateway_ref     text        not null,         -- payment_id / transaction_id from gateway
  amount_paise    integer     not null,         -- always in paise (INR×100) for consistency
  currency        text        not null default 'INR',
  status          text        not null default 'paid', -- 'paid' | 'refunded' | 'disputed'

  -- Period covered
  period_start    timestamptz,
  period_end      timestamptz,

  -- Timestamps
  issued_at       timestamptz not null default now(),
  refunded_at     timestamptz
);

-- Indexes for fast lookup
create index if not exists payment_invoices_user_idx    on payment_invoices (user_id, issued_at desc);
create index if not exists payment_invoices_org_idx     on payment_invoices (org_id, issued_at desc);
create index if not exists payment_invoices_gateway_idx on payment_invoices (gateway_ref);

-- RLS: users can read their own invoices
alter table payment_invoices enable row level security;

create policy "Users read own invoices"
  on payment_invoices for select
  using (auth.uid() = user_id);

create policy "Org admins read org invoices"
  on payment_invoices for select
  using (
    org_id is not null and exists (
      select 1 from org_members om
      where om.org_id  = payment_invoices.org_id
        and om.user_id = auth.uid()
        and om.role    in ('owner','admin')
        and om.status  = 'active'
    )
  );

-- No client writes — service_role only
