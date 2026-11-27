-- docs/sql/lock_money_functions.sql — #172 security (27 Nov 2026)
--
-- 🔴 FOUND LIVE: these SECURITY DEFINER functions were executable by `anon` and `authenticated`,
-- i.e. by ANYONE holding the public Supabase key (it ships inside the app and the website).
-- They take the user id and amounts as plain arguments and never check who is calling, so
-- anyone could, via POST /rest/v1/rpc/<name>:
--   • grant_license_atomic      — give themselves Plus for any number of days, or credits
--   • credit_imotara_wallet / increment_wallet_earnings / increment_pending_payout — add money
--   • decrement_* / finalize_completed_payout — wipe other people's balances
-- Postgres grants EXECUTE to PUBLIC by default on every new function; the migrations never revoked it.
--
-- ✅ Every caller in the code uses the SERVICE-ROLE client (getSupabaseAdmin) — checked 27 Nov:
-- grantLicense.ts, creditConsultant.ts, connect/sessions, sessions/[id]/tick, consultant/payout,
-- admin/connect/refunds, cron/heartbeat. The mobile app calls none of them. ⇒ nothing breaks.
-- Trigger functions keep working: Postgres does not check EXECUTE when a trigger fires.
--
-- Run ONCE in the Supabase SQL editor (owner OK). Changes permissions only — no data.

begin;

do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'grant_license_atomic',
        'credit_imotara_wallet', 'decrement_wallet_balance',
        'increment_wallet_earnings', 'increment_pending_payout', 'decrement_pending_payout',
        'finalize_completed_payout', 'get_session_balance',
        'increment_sessions_completed', 'increment_ledger_attempt',
        'update_consultant_rating', 'bump_cron_heartbeat', 'cleanup_expired_admin_sessions',
        '_set_connect_payouts_updated_at', 'release_licenses_on_org_delete', 'rls_auto_enable'
      )
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', f.sig);
    execute format('grant execute on function %s to service_role', f.sig);
  end loop;
end $$;

commit;

-- ── Proving it (expected: 0 rows — no SECURITY DEFINER function in public is callable by the
--    public key, except the two org-membership helpers that check auth.uid() themselves) ──
select p.proname
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.prosecdef
  and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute'))
  and p.proname not in ('imotara_is_org_admin', 'imotara_is_org_member', 'org_allows_public_connect')
order by 1;
