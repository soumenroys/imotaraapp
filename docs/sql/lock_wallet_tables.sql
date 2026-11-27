-- docs/sql/lock_wallet_tables.sql — #172 security (27 Nov 2026)
--
-- 🔴 FOUND LIVE: imotara_wallets, imotara_wallet_transactions, imotara_wallet_orders and
-- imotara_wallet_refund_requests each had a `FOR ALL using (auth.uid() = user_id)` policy plus
-- INSERT/UPDATE/DELETE grants to `authenticated` ⇒ any signed-in person — and every app GUEST is
-- `authenticated` — could set their own wallet balance, invent transactions and file refund
-- requests for any amount, straight from the public API.
--
-- ✅ Only the server (service role) writes these tables — checked 27 Nov: no web page, component
-- or mobile code writes them; the API routes use getSupabaseAdmin. Users keep READ access to
-- their own rows. Run ONCE in the Supabase SQL editor (owner OK). Permissions only — no data.

begin;

drop policy if exists users_own_wallet              on public.imotara_wallets;
drop policy if exists users_own_wallet_transactions on public.imotara_wallet_transactions;
drop policy if exists users_own_wallet_orders       on public.imotara_wallet_orders;
drop policy if exists users_own_refund_requests     on public.imotara_wallet_refund_requests;

create policy users_read_own_wallet              on public.imotara_wallets                for select to authenticated using (auth.uid() = user_id);
create policy users_read_own_wallet_transactions on public.imotara_wallet_transactions    for select to authenticated using (auth.uid() = user_id);
create policy users_read_own_wallet_orders       on public.imotara_wallet_orders          for select to authenticated using (auth.uid() = user_id);
create policy users_read_own_refund_requests     on public.imotara_wallet_refund_requests for select to authenticated using (auth.uid() = user_id);

revoke insert, update, delete, truncate on public.imotara_wallets, public.imotara_wallet_transactions,
  public.imotara_wallet_orders, public.imotara_wallet_refund_requests from anon, authenticated;

commit;

-- ── Proving it (expected: 0 rows) ──
select tablename, policyname, cmd from pg_policies
where schemaname = 'public' and tablename ~ '^imotara_wallet' and cmd <> 'SELECT';
