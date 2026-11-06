-- docs/sql/licenses_billing_issue.sql
-- "Your payment didn't go through" — the billing grace period, on the licence.
-- Run ONCE in the Supabase SQL editor. ⇒ src/lib/imotara/billingIssue.ts
--
-- 6 Nov 2026: Apple's billing grace period is ON (16 days, paid-to-paid). The
-- daily renewal check now records when a subscriber is in grace, so the app
-- and the website can say so, and one email goes out.
-- Adding columns to an existing table needs no new GRANTs.

alter table licenses add column if not exists billing_issue             text;
alter table licenses add column if not exists billing_issue_until       timestamptz;
alter table licenses add column if not exists billing_issue_store       text;
alter table licenses add column if not exists billing_issue_notified_at timestamptz;

alter table licenses drop constraint if exists licenses_billing_issue_known;
alter table licenses add constraint licenses_billing_issue_known
  check (billing_issue is null or billing_issue = 'grace');

alter table licenses drop constraint if exists licenses_billing_issue_store_known;
alter table licenses add constraint licenses_billing_issue_store_known
  check (billing_issue_store is null or billing_issue_store in ('apple', 'google_play'));

-- check (expected: 4 rows)
select column_name, data_type from information_schema.columns
where table_name = 'licenses' and column_name like 'billing_issue%' order by 1;
