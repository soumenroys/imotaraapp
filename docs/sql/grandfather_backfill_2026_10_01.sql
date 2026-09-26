-- grandfather_backfill_2026_10_01.sql
--
-- L20 — the grandfather backfill. Run BEFORE enforcement (L23/L24) goes live.
-- Cutoff: 2026-10-01 (owner, 2026-09-26).  Drafted + verified against live data
-- 2026-09-26.  ⚠️ NOT YET RUN — needs explicit confirmation.
--
-- ── WHY THIS EXISTS ─────────────────────────────────────────────────────────
-- Licensing has been OFF for 291 days; every account holder has had every
-- feature free. Flipping enforcement without this takes history beyond 7 days,
-- export, trends, search, cadence, companion letters, growth arc and advanced
-- TTS away from people who were told they would keep them.
--
-- The decision (2026-09-17) fixes the mechanism:
--   "Route 2: explicit backfill. A promise of 'permanently' is stored as DATA,
--    not as an `if`."
-- So this writes rows. It does not add a special case to the resolver.
--
-- ── 🔑 THE DESIGN: A FLOOR, NEVER AN OVERWRITE ──────────────────────────────
-- The first draft of this file said `update licenses set tier='plus' where
-- tier='free'`. Checking it against live data showed that was BACKWARDS:
--
--   1 edu row had ALREADY expired (2026-09-01)      → resolves to free today
--   3 edu rows expire 2026-10-02                    → ONE DAY AFTER the cutoff
--   1 family row expires 2026-10-11
--
-- `where tier='free'` skips all five. The only users who ever held a real
-- licence would have got NOTHING and dropped to free within two weeks of the
-- cutoff — ending up with LESS than a never-paid user granted permanent Plus.
--
-- So each row gets a permanent FLOOR under whatever it already has, and no
-- step may lower an effective tier. resolve_user_tier() already implements
-- floor semantics, which is what makes this safe — see step 3.
--
-- ── ⚠️ THE FAILURE MODE IS SILENT ───────────────────────────────────────────
-- 68 of 79 rows are status='trial' WITH an expiry, and they resolve to FREE.
-- A backfill with the wrong status, or ANY non-null expires_at, grants NOTHING
-- and still reports "N rows updated". Run the STEP 4 checks. Do not skip them.
--
-- ⚠️ Anonymous / local-only users have no server identity and CANNOT be
-- grandfathered. Accepted: local replies are free regardless.
--
-- ── LIVE STATE AT DRAFTING (2026-09-26) ─────────────────────────────────────
--   auth.users ................ 375      (the 248 figure from 09-17 is stale)
--   licence rows .............. 79   → 296 accounts have NO row
--   tier=free ................. 72       0 of them carry an org_id
--   tier=edu .................. 4        all 4 are active org_members
--   tier=family ............... 1        personal, no org
--   tier=plus ................. 2        1 razorpay (₹149 test), 1 apple (already NULL)
--   org_license_pools ......... 0    org_license_assignments .... 0
-- No CHECK constraints on tier/status/source — all plain text.

-- ════════════════════════════════════════════════════════════════════════════
-- STEP 1 — DRY RUN. Read these BEFORE running anything below.
-- ════════════════════════════════════════════════════════════════════════════

-- 1a. Scale. Compare against the figures above; if they have drifted a lot,
--     re-read this file's assumptions before continuing.
select
  (select count(*) from auth.users)                              as auth_users,
  (select count(*) from public.licenses)                         as licence_rows,
  (select count(*) from auth.users u
     where not exists (select 1 from public.licenses l where l.user_id = u.id))
                                                                 as need_new_row;

-- 1b. Every existing row, and what it resolves to TODAY. Keep this output —
--     step 4a diffs against it.
select l.tier as stored, l.status, l.expires_at, l.source, l.org_id is not null as has_org,
       r.effective_tier, r.tier_source
from   public.licenses l
cross  join lateral public.resolve_user_tier(l.user_id) r
order  by l.tier, l.expires_at nulls first;

-- ════════════════════════════════════════════════════════════════════════════
-- STEP 2 — THE BACKFILL. One transaction: run, check, then COMMIT.
-- ════════════════════════════════════════════════════════════════════════════

begin;

-- 2a. Rows sitting on `free` → permanent plus.
--
--     `org_id is null` is INSURANCE, not a no-op. 0 free rows carry an org_id
--     today, but the org-provisioning path writes exactly that shape
--     (tier='free', source='org', org_id set — razorpay/webhook:113,
--     stripe/webhook:93). If an org is provisioned between now and the run,
--     granting its seats permanent personal plus would outlive the org's
--     licence: an ex-member keeps Plus forever. That is the seat-leak pattern
--     from the Jul NGO audit. Do not remove this predicate.
update public.licenses
set    tier       = 'plus',
       status     = 'valid',
       expires_at = null,                  -- 🔴 NULL = permanent. A date here grants nothing past it.
       source     = 'grandfather',
       notes      = coalesce(notes || ' · ', '') ||
                    'grandfathered 2026-10-01 — permanent plus, pre-cutoff account',
       updated_at = now()
where  tier = 'free'
  and  org_id is null;                     -- expect 72 rows

-- 2b. Accounts with NO licence row → create one.
insert into public.licenses (user_id, tier, status, expires_at, token_balance, source, notes, updated_at)
select u.id, 'plus', 'valid', null, 0, 'grandfather',
       'grandfathered 2026-10-01 — permanent plus, pre-cutoff account', now()
from   auth.users u
where  not exists (select 1 from public.licenses l where l.user_id = u.id);
                                           -- expect 296 rows

-- 2c. 🔑 THE FLOOR UNDER THE ORG-DERIVED `edu` ROWS. The subtle one.
--
--     These 4 rows are a redundant COPY of the org's tier: the resolver reads
--     organizations.tier for the org branch, never licenses.tier, and there
--     are no pools or assignments. All 4 users are active org_members.
--
--     Rewriting the personal row to plus/NULL does NOT downgrade them, because
--     the org branch's test is a STRICT `>`:
--       before: tier_rank('edu') 4 >  tier_rank('edu')  4  → false → personal → edu
--       after : tier_rank('edu') 4 >  tier_rank('plus') 1  → TRUE  → org      → edu
--     Same effective tier today, from a different branch. Once the org licence
--     lapses the org branch drops out and they land on permanent plus instead
--     of free. org_id is deliberately preserved.
--
--     🔴 VERIFY THIS IN STEP 4b. If a live org's tier were ever ranked at or
--     below plus, this WOULD be a downgrade.
update public.licenses
set    tier       = 'plus',
       status     = 'valid',
       expires_at = null,
       notes      = coalesce(notes || ' · ', '') ||
                    'grandfathered 2026-10-01 — permanent plus floor under org tier; '
                    'org licence still governs while live',
       updated_at = now()
where  tier = 'edu';                       -- expect 4 rows
       -- source stays 'org': these seats came from an org and the audit trail should say so.

-- 2d. The one personal `family` row → permanent family.
--     Writing 'plus' here WOULD downgrade them: there is no org to supply
--     family, and family outranks plus. Keep the tier, drop the expiry.
update public.licenses
set    expires_at = null,
       status     = 'valid',
       notes      = coalesce(notes || ' · ', '') ||
                    'grandfathered 2026-10-01 — expiry removed, tier unchanged',
       updated_at = now()
where  tier = 'family';                    -- expect 1 row

-- ── Check INSIDE the transaction ────────────────────────────────────────────
select tier, status, source,
       count(*)                                   as rows,
       count(*) filter (where expires_at is null) as permanent
from   public.licenses
group  by tier, status, source
order  by tier, source;

commit;
-- rollback;   -- ← use this instead if anything above looks wrong

-- ════════════════════════════════════════════════════════════════════════════
-- STEP 3 — ⚠️ OWNER DECISION. The 2 paying `plus` rows. Run separately or skip.
-- ════════════════════════════════════════════════════════════════════════════
--
-- Left out of step 2 on purpose, because it is a judgement call, not a fact:
--
--   razorpay · expires 2026-12-28 · the ₹149 live test paid on 2026-09-23
--   apple    · expires NULL       · ALREADY permanent by deliberate grant on
--                                   2026-09-18 ("was launch-offer")
--
-- FOR: both are pre-cutoff account holders, so the promise covers them; and
--      the Apple row already sets the precedent of NULL for exactly this.
-- AGAINST: NULL lets a subscriber cancel and keep Plus for ever. Only the
--      razorpay row is actually affected, and it is the owner's own test
--      account — so the downside is ~zero in practice.
--
-- This is a ONE-TIME snapshot: new payers after the cutoff go through
-- grant_license_atomic(), which always writes a real expiry. Nothing here
-- changes that.
--
-- Recommendation: RUN IT — consistency with the Apple row, cost of one row.
--
-- update public.licenses
-- set    expires_at = null,
--        notes      = coalesce(notes || ' · ', '') ||
--                     'grandfathered 2026-10-01 — pre-cutoff paid subscriber, expiry removed',
--        updated_at = now()
-- where  tier = 'plus'
--   and  source in ('razorpay','apple','stripe')
--   and  expires_at is not null;           -- expect 1 row

-- ════════════════════════════════════════════════════════════════════════════
-- STEP 4 — VERIFY THE GRANT IS REAL. A row is not a grant.
-- ════════════════════════════════════════════════════════════════════════════

-- 4a. 🔴 THE ONE THAT MATTERS. Does the RESOLVER agree? licenses.tier saying
--     'plus' proves nothing — resolve_user_tier() is what the app asks, and it
--     is the function that ignores a row whose expiry has passed.
select r.effective_tier, r.tier_source, r.status, count(*)
from   public.licenses l
cross  join lateral public.resolve_user_tier(l.user_id) r
group  by r.effective_tier, r.tier_source, r.status
order  by count(*) desc;
-- Expect: NOTHING resolving to 'free'. The 4 edu users show effective_tier
-- 'edu' via tier_source 'org' (not 'personal') — that is 2c working.

-- 4b. 🔴 NOBODY WENT DOWN. This is the anti-downgrade check for 2c and 2d;
--     it must return ZERO rows.
select l.user_id, l.tier as stored_now, r.effective_tier, r.tier_source
from   public.licenses l
cross  join lateral public.resolve_user_tier(l.user_id) r
where  public.tier_rank(r.effective_tier) < public.tier_rank('plus');
-- Any row here means someone is below Plus after a backfill meant to floor
-- them AT Plus. Investigate before flipping LICENSE_MODE.

-- 4c. Nothing left on free; no grandfather row carries an expiry.
select count(*) as still_free       from public.licenses where tier = 'free';
select count(*) as grandfather_with_expiry from public.licenses
  where source = 'grandfather' and expires_at is not null;
-- Expect: 0 and 0.

-- 4d. Every account has a row.
select count(*) as accounts_without_a_licence
from   auth.users u
where  not exists (select 1 from public.licenses l where l.user_id = u.id);
-- Expect: 0.

-- 4e. The org seats still belong to their org.
select count(*) as org_seats_lost_their_org
from   public.licenses
where  source = 'org' and org_id is null;
-- Expect: 0.
