-- docs/sql/payment_invoices_one_per_payment.sql
-- ONE invoice per payment. Run ONCE in the Supabase SQL editor.
--
-- 🔴 6 Nov 2026: every Razorpay payment had THREE invoices (16 rows, 6 real
-- payments, 10 copies), because verify-payment and two webhook events each
-- wrote one. Code fix: lib/imotara/claimPayment.ts + createInvoice looks first.
-- This file makes the database refuse a second invoice for the same payment.
--
-- Step 1 keeps the FIRST invoice of each payment (lowest issued_at) and removes
-- the later copies. Step 2 adds the rule. Both inside one transaction.

begin;

-- 1) the copies (expected: 10 rows on 6 Nov 2026)
delete from payment_invoices p
using payment_invoices keep
where p.payment_gateway = keep.payment_gateway
  and p.gateway_ref     = keep.gateway_ref
  and (keep.issued_at, keep.id) < (p.issued_at, p.id);

-- 2) the rule
create unique index if not exists payment_invoices_one_per_payment
  on payment_invoices (payment_gateway, gateway_ref)
  where gateway_ref is not null;

commit;

-- check (expected: 0 rows)
select payment_gateway, gateway_ref, count(*)
from payment_invoices group by 1, 2 having count(*) > 1;
