-- drop_legacy_grant_license_atomic.sql
--
-- Migration STEP 3, the last one owed from grant_license_store_expiry.sql.
-- Drops the legacy **6-argument** grant_license_atomic, leaving only the
-- 7-argument form that takes the STORE's absolute expiry.
--
-- ⚠️ NOT YET RUN — needs explicit confirmation. Owner-executed; I cannot run SQL.
--
-- ── WHY THIS IS NOT COSMETIC ────────────────────────────────────────────────
-- The 6-argument version is the one WITHOUT `p_expires_at`. It extends a
-- subscription by counting OUR catalog days forward, which for Apple and Google
-- Play is a guess about what the store did. With introductory offers live since
-- 2026-09-24 that guess is wrong in the user's favour:
--
--     a 7-day free trial would grant 31 DAYS of Plus.
--     Cancel on day 2, keep 29 free days. Repeatable, once per account.
--
-- While both overloads exist, that bug is one mistaken call away from coming
-- back. Dropping it makes the wrong behaviour unreachable rather than merely
-- unused — which is the whole point of finishing a migration.
--
-- ── WHY IT IS SAFE NOW ──────────────────────────────────────────────────────
-- Verified 2026-09-27:
--   * Exactly ONE caller in the codebase — `lib/imotara/grantLicense.ts:64` —
--     and it passes all SEVEN arguments, `p_expires_at` included (NULL for
--     Razorpay/Stripe, which have no store expiry).
--   * The mobile app makes NO direct RPC call; it goes through our API. So no
--     shipped client can reach the 6-argument form. Grep: 0 hits in imotara-mobile.
--   * A REAL grant has already succeeded on the 7-argument path — the live ₹149
--     payment on 2026-09-26 (`pay_TgaD7yZa9KDbd6`), which is exactly the
--     condition step 3 was waiting on.
--
-- 🔑 PostgREST resolves overloads by the argument NAMES in the request body.
-- Our caller always sends `p_expires_at`, so it has always selected the
-- 7-argument function. Dropping the other one cannot change which is called.

-- ════════════════════════════════════════════════════════════════════════════
-- STEP 1 — LOOK FIRST. Which overloads actually exist?
-- ════════════════════════════════════════════════════════════════════════════
select
  p.oid::regprocedure                    as signature,
  pg_get_function_arguments(p.oid)       as arguments,
  pg_get_function_result(p.oid)          as returns
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'grant_license_atomic'
order by pg_get_function_arguments(p.oid);

-- Expect TWO rows: one ending `text` (6 args, legacy) and one ending
-- `timestamp with time zone` (7 args, current).
--
-- ⛔ If only ONE row comes back and it has 7 arguments, the drop has already
--    happened — STOP, there is nothing to do.
-- ⛔ If only ONE row comes back and it has 6 arguments, the 7-argument
--    migration was never applied — STOP and run grant_license_store_expiry.sql
--    first. Dropping here would break every grant.

-- ════════════════════════════════════════════════════════════════════════════
-- STEP 2 — THE DROP. Only after STEP 1 showed both.
-- ════════════════════════════════════════════════════════════════════════════
DROP FUNCTION IF EXISTS
  public.grant_license_atomic(uuid, boolean, text, integer, integer, text);

-- ════════════════════════════════════════════════════════════════════════════
-- STEP 3 — VERIFY. Exactly one overload must remain, and it must be the 7-arg.
-- ════════════════════════════════════════════════════════════════════════════
select
  count(*)                                               as overloads_remaining,
  bool_or(pg_get_function_arguments(p.oid) like '%p_expires_at%') as keeps_store_expiry
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'grant_license_atomic';
-- Expect: overloads_remaining = 1, keeps_store_expiry = true.

-- ⚠️ AFTER RUNNING, RELOAD POSTGREST'S SCHEMA CACHE or the dropped signature
-- may linger in the API layer:
--     notify pgrst, 'reload schema';
--
-- 🔑 THEN PROVE IT WITH A REAL GRANT, not with this query. A licence grant is
-- the one path where "the function exists" and "a user got what they paid for"
-- are different claims. The cheapest proof is a licence-tester purchase on
-- Play once the products are activated.
