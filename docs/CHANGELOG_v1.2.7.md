# Imotara v1.2.7 (build 107) — Changelog

**vs v1.2.6 (build 106)**
**Date:** 2026-07-16
**Commit ranges:** web `f19e43e..70d262a` (16 commits) · mobile `98dee52..71931d5` (5 commits)

This release is almost entirely the 5-pass NGO/organization audit conducted this session — 29 findings across licensing, admin tooling, security, and mobile.

---

## 🔒 Security / billing integrity

- **Cross-org seat leak, closed in 6 places** — a user already holding a paid seat in one org could join a different org (via invite, the new domain-join link, admin add-by-email, self-serve org creation, or — most severely — by simply paying for their own corporate plan via Razorpay or Stripe with zero admin involvement) and end up "active" in both, permanently leaking a seat the first org kept paying for. New `releasePriorOrgMembership()` helper now closes this at every entry point.
- **Privilege escalation fixed** — a Connect-scoped reviewer role could unban any user and read any ban record; the unban/read endpoints were missing a role check the ban endpoint already had. Became actually dangerous once "ban" itself was made to work (see below).
- **"Ban user" now actually bans the user** — it previously only set an inert database flag nothing else in the app ever checked; a banned user could keep using Imotara completely normally. Now uses a real Supabase-level ban that blocks sign-in and session refresh.
- **License-pool capacity leak fixed** — a pool-assigned seat stayed permanently occupied after the person left the org, with no admin-visible signal. Member removal now releases pool capacity automatically.
- **TOCTOU race closed on org creation** — concurrent double-submits could give one user two owned orgs; now enforced with a database-level unique constraint.
- **API-key rate limiting made a real global cap** — was in-memory per serverless instance, so the effective limit scaled with warm-instance count instead of being precise.

## ✨ New capabilities (superadmin tooling)

- **Add an existing user to an org directly by email** — previously superadmin could only manage members who'd already joined themselves.
- **Read-only audit-log viewer** for any org's activity (invites, role changes, removals, tier changes) — this data existed and was shown to org admins, but superadmin had no equivalent view.
- **Aggregate usage-stats viewer** for any org (WAU, avg session length, active days) — deliberately excludes individual-member data, holding the same aggregate-only privacy line the product has always used.
- **Suspend/restore account access** — a real, reversible way to lock a compromised or problem account out immediately.
- **Manual account-recovery tool** — generates a one-time sign-in link for someone who's permanently lost the Google/Apple account their Imotara identity is tied to. Deliberately not self-service; a human verifies the request before any link is delivered.

## 🐛 Bug fixes

- **NGO verification now has a real approve/reject outcome** — previously could only ever sit at "pending review" forever, with no endpoint anywhere able to resolve it.
- **Domain auto-join made durable and repeatable** — previously piggybacked on a single-use invite link that only the first claimant could use (and could even lock out the invite's real intended recipient). Now a dedicated, shareable link any number of eligible people can use.
- **Domain auto-join opened to NGOs** — was accidentally gated to EDU organizations only, even though the backend always supported both.
- **Cohorts/Teams "add member" control built** — the UI told admins to add members from elsewhere, but no such control existed anywhere; that path was completely non-functional.
- **Certificate eligibility badge fixed** — showed "Eligible" and an active download button based on seat count alone, ignoring the backend's additional 30-day org-age requirement; clicking would silently fail.
- **Mobile: banned/suspended users are no longer silently signed out with zero explanation** — they now see a clear notice instead of being quietly downgraded to an anonymous session, indistinguishable from a fresh install.
- **Mobile: broken settings-search results fixed** — 4 entries (including a new NGO one) pointed at a dead accordion reference and silently did nothing when tapped.
- **Mobile: upgrade prompts fully hidden from org members** — 3 remaining surfaces (chat quota card, trial banner, plan panel) still showed personal-upgrade prompts to people whose plan is managed by their org.
- **Mobile: org context now stays fresh** — previously only refreshed at app launch, so a mid-session org change left a stale badge until restart.

## 📝 Corrected overclaims (UI/docs said one thing, product did another)

- NGO licensing doc and two in-app locations claimed document verification was required for subsidized pricing — it isn't; the discount applies unconditionally at checkout.
- "Impact Report (Grant-ready PDF)" — the report is HTML, not a PDF; label corrected.
- LMS/iframe embed and referral commission tracking both had working-looking UI for features that don't actually function yet — now honestly marked "Coming soon."

---

## Database migrations applied this release

Three manual SQL migrations were run in the Supabase SQL Editor as part of this release:

1. `docs/sql/api_key_rate_limit.sql` — global API rate limiter
2. `docs/sql/fix_pool_release_on_member_removal.sql` — license-pool capacity leak fix
3. `docs/sql/org_owner_race_lockdown.sql` — org-owner creation race lockdown

## Full commit lists

### Web (`f19e43e..70d262a`)
1. `1b23415` fix(ngo): add verification approve/reject path, correct NGO licensing doc overclaims
2. `f5dda66` fix(ngo): stop advertising two NGO features that don't actually work yet
3. `cc80042` fix(org): make domain auto-join durable and repeatable instead of single-use
4. `eeb3dd6` feat(org): surface org billing_type in resolved tier + license status
5. `9a404e0` fix(org): make API-key rate limiting a real global cap, not per-instance
6. `0c93f76` fix(org): open domain auto-join to NGOs, stop claiming Impact Report is a PDF
7. `e609a91` feat(admin): add member-add, audit-log oversight, aggregate analytics, and account suspension
8. `6a79981` feat(admin): add manual account-recovery tool for permanently lost OAuth accounts
9. `385c06b` fix(admin): make "ban user" actually ban the user
10. `7371a8a` fix(org): close privilege escalation + cross-org seat leak, fix two more overclaims
11. `7a9fd0e` fix(org): minor cleanup batch from the 4th-pass re-audit
12. `5d34867` fix(org): close 3 more seat-leak paths, fix pool capacity leak, build missing cohort-add UI
13. `925a4d7` fix(org): remaining P3 cleanup — pool quantity validation, apikeys tier check, owner race
14. `70d262a` chore(release): bump version to 1.2.7, build 107

### Mobile (`98dee52..71931d5`)
1. `4fc5efb` fix(licensing): hide upgrade prompts from org members in chat, trial banner, and plan panel
2. `e4bf33b` fix(licensing): keep org context in sync on every auth event, not just app launch
3. `3f7fc72` feat(org): NGO/EDU/govt-aware "Managed by" badge, make it settings-search discoverable
4. `9d38d6c` fix(auth): notify user on unexpected session loss, fix broken settings-search navigation
5. `71931d5` chore(release): bump version to 1.2.7, build 107

---

## Release status

- **Android**: build 107 completed and submitted — confirmed live in the Play Console production track (status: completed) via a direct read-only check against the Play Developer API.
- **iOS**: build 107 completed and uploaded to App Store Connect; submitted for App Store review.

Both platforms are now past the last-live version (v1.2.6/build 106), so this changelog's fixes are on their way to real users pending store review.
