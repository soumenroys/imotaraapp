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
-- ── LIVE STATE — dry run CONFIRMED in the SQL Editor 2026-09-26 ─────────────
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

-- 2e. The 2 paying `plus` rows → permanent.
--     ✅ OWNER APPROVED 2026-09-26 ("proceed"). Was step 3, now folded in.
--     Only the razorpay row is actually affected: the apple row is ALREADY
--     NULL from the deliberate 2026-09-18 grant, so this makes the two
--     consistent. Both are pre-cutoff account holders, so the promise covers
--     them.
--     ⚠️ Accepted trade-off: NULL lets a subscriber cancel and keep Plus. The
--     one affected row is the owner's own ₹149 live test (2026-09-23).
--     This is a ONE-TIME snapshot — new payers go through grant_license_atomic(),
--     which always writes a real expiry. Nothing here changes that.
--
--     🔑 Provably cannot catch the rows the steps above just created: 2a and 2c
--     set expires_at = NULL (failing `expires_at is not null`), and the edu
--     rows keep source = 'org' (failing the source filter).
update public.licenses
set    expires_at = null,
       notes      = coalesce(notes || ' · ', '') ||
                    'grandfathered 2026-10-01 — pre-cutoff paid subscriber, expiry removed',
       updated_at = now()
where  tier = 'plus'
  and  source in ('razorpay','apple','stripe')
  and  expires_at is not null;             -- expect 1 row

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
-- STEP 3 — (was the owner decision on the 2 paying rows) → DECIDED, now 2e.
-- ════════════════════════════════════════════════════════════════════════════
-- Owner approved 2026-09-26. Moved into the transaction above as step 2e so the
-- whole backfill commits or rolls back as one unit.

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

-- ════════════════════════════════════════════════════════════════════════════
-- ✅ RUN AND VERIFIED 2026-09-26, in the Supabase SQL Editor.
--
--   375 rows · all permanent · zero free.
--     plus/grandfather 368 · plus/org 4 · plus/apple 1 · plus/razorpay 1 · family 1
--   resolve_user_tier(): plus/personal/valid 371 · edu/org/active 3 · family 1
--   all five zero-checks returned 0, including the anti-downgrade check.
--
-- 🔑 The 3 live edu users moved from tier_source 'personal' to 'org' — that is
--    step 2c working: the Plus floor now sits UNDER the org tier.
-- ════════════════════════════════════════════════════════════════════════════

-- ════════════════════════════════════════════════════════════════════════════
-- STEP 5 — THE PRE-CUTOFF RE-RUN. Run once more just before 2026-10-01.
-- ════════════════════════════════════════════════════════════════════════════
--
-- 🔴 WHY. The backfill ran on 09-26; the cutoff is 10-01. Anyone who signs up
-- in between is a pre-cutoff account holder and the promise covers them, but
-- the run above could not have seen them.
--
-- 🔴 WHY THIS IS NOT JUST "run step 2 again". Step 2a is `where tier='free'`
-- with no date bound. Run it on 2026-10-02 and it grandfathers POST-cutoff
-- signups too — permanently, and with no way to tell them apart afterwards.
-- The window is the whole point, so the window is in the query.
--
-- These two are bounded by created_at, so they are safe to run at ANY time,
-- before or after the cutoff, as many times as you like.

begin;

-- 5a. Pre-cutoff accounts that acquired a free row after the 09-26 run.
update public.licenses
set    tier       = 'plus',
       status     = 'valid',
       expires_at = null,
       source     = 'grandfather',
       notes      = coalesce(notes || ' · ', '') ||
                    'grandfathered 2026-10-01 — permanent plus, pre-cutoff account (late sweep)',
       updated_at = now()
where  tier = 'free'
  and  org_id is null
  and  created_at < timestamptz '2026-10-01 00:00:00+00';

-- 5b. Pre-cutoff accounts still with no licence row at all.
insert into public.licenses (user_id, tier, status, expires_at, token_balance, source, notes, updated_at)
select u.id, 'plus', 'valid', null, 0, 'grandfather',
       'grandfathered 2026-10-01 — permanent plus, pre-cutoff account (late sweep)', now()
from   auth.users u
where  not exists (select 1 from public.licenses l where l.user_id = u.id)
  and  u.created_at < timestamptz '2026-10-01 00:00:00+00';

commit;

-- Then re-run the STEP 4 checks. `still_free` may now be NON-zero and that is
-- CORRECT — it counts post-cutoff signups, who are not grandfathered. Every
-- other check must still be 0.
--
-- To see only the ones that should have been caught:
--   select count(*) from public.licenses
--   where tier = 'free' and org_id is null
--     and created_at < timestamptz '2026-10-01 00:00:00+00';   -- must be 0
