# Imotara Knowledge Base — START HERE (Index)

This Project is the knowledge base for **Imotara** — a privacy-first, emotion-aware AI companion for mental wellbeing ("An Immortal Friend for Your Emotions"), available on web (www.imotara.com), iOS, and Android. Ask any question about the product, code, operations, administration, or support in this Project and the answer should be findable in these docs.

**Current release:** v1.2.7 (build 107) · **Repos:** `github.com/soumenroys/imotaraapp` (web + entire backend), `github.com/soumenroys/imotara-mobile` (Expo/RN app), `github.com/soumenroys/imotara` (legacy static concept/landing page — pre-product, historical only). · **Backend:** one Vercel deployment + one Supabase project shared by web and mobile. · **Contact:** info@imotara.com / soumenroys@gmail.com.

## Reference docs (what things are and how they work)

| Doc | Use it for |
|---|---|
| **Imotara Product Overview & Positioning** | What Imotara is, mission, features, 22 languages, personas, competitors, brand voice, B2B story — marketing & general questions |
| **Web App Technical Guide** | Web/backend stack, repo layout, routing, auth model, core libraries, env vars, testing, fragile areas |
| **Mobile App Technical Guide** | Expo/RN stack, screens, mobile auth (incl. the accessToken vs anonymousAccessToken rule), TTS, sync, payments, storage keys, fragile areas |
| **AI, TTS & Language Systems** | How replies are generated (orchestrator, models, fallbacks), language/emotion detection, TTS/STT, safety systems, quotas |
| **Licensing, Tiers & Payments** | Tier matrix, feature gating, soft-launch state, effective-tier resolution, payment rails overview |
| **Database & Backend Reference** | Supabase schema (all tables), RPCs & triggers, RLS, full API route catalog, cron jobs, env var reference, migration process |
| **Imotara Admin Guide (Super-Admin)** | Operator reference: superadmin roles/creation, 2FA, password resets, bans, licenses, NGO verification, org oversight, comment moderation |
| **Organization Owner & Admin How-Tos** | Org owner/admin reference: create an org, invites, domain auto-join, seats & pools, cohorts, analytics, API keys, org deletion — with honest "Coming soon" flags |
| **Imotara Connect (Consultant Marketplace)** | Connect reference: marketplace model, wallet architecture, consultant lifecycle, moderation, safety rules |
| **Release Runbook (Web + Mobile)** | Shipping a release end-to-end: version bump, Vercel deploy, manual SQL migrations, webhook checks, EAS builds, store submission, OTA rules, rollback |
| **User Support FAQ** | Ready-made Q&A answers for end-user questions |

## Step-by-step playbooks (numbered procedures to follow or read aloud)

| Doc | Use it for |
|---|---|
| **Playbook — Organizations & NGOs End-to-End** | Chained scenarios with WHO/WHERE/behind-the-scenes per step: create an NGO org → Imotara verification/activation → appoint org admins → add users (invite, bulk CSV, domain auto-join) → licenses & pools → cohorts → analytics → remove members → delete org → API access |
| **End-User Step-by-Step Guide** | Numbered how-tos for every user task, web + mobile variants with real button labels: account setup, companion config, chat, voice, language switching, sync/Link Key, letters & arcs, memory, notifications, privacy/export/delete, upgrades, org joining, settings search |
| **Playbook — Imotara Connect Journeys** | User journeys (first session, scheduled session, refunds/expiry) and the full consultant journey (application → review → live → earnings → payout), minute-by-minute billing mechanics, safety/moderation |
| **Playbook — Payments & Purchases** | Buying a plan step-by-step per platform (web Razorpay, Android IAP/Razorpay, iOS IAP + Restore, Stripe), token packs, donations, cancellations — plus support diagnostics ("paid but no license" per rail, double charges, refunds) |
| **Support Troubleshooting Playbooks** | Symptom → causes → numbered diagnosis (exact endpoints, tables, SQL, log strings) → resolution → escalation, for 14 common symptoms (sign-in, sync, silent AI, TTS, wrong language, payments, org badge, invites, notifications, admin lockout, Connect, health, crashes) |

## Quick answers to the most common questions

- **"How do I create a superadmin?"** → Admin Guide §2: `POST /api/admin/auth/seed` (works only while `super_admins` is empty); afterwards owners create admins from `/admin` → Admins tab.
- **"How do I create an NGO, its admin, and add users?"** → Playbook — Organizations & NGOs End-to-End, Scenarios 1–3 (the full chain with every step).
- **"Why did a free user stop getting AI replies?"** → 20 cloud replies/day server quota; the app falls back to local replies (Troubleshooting runbook 3).
- **"Is everything free right now?"** → Yes — soft launch: license enforcement is off (web `LICENSE_MODE=off`, mobile `SOFT_LAUNCH_BYPASS_ALL_GATES=true`); the 20/day free quota still applies.
- **"How do I ship a release?"** → Release Runbook, Part D order of operations (DB migrations → web → verify → mobile → stores).
- **"User paid but has no license"** → Playbook — Payments & Purchases, diagnostic section (per-rail checklists).
- **"A member's tier looks wrong"** → Org How-Tos §2 priority chain (pool > override > higher of personal vs org default) + Troubleshooting runbook 7.

## Known open items & findings (as of 2026-07-17, refreshed 2026-07-18)

**RESOLVED since this KB was generated** (all fixed and shipped 2026-07-18 — the code below has moved on from what the rest of this KB describes in places; treat those spots as historical unless noted):
- ✅ **Connect payout accounting hole** — fixed via `finalize_completed_payout()` RPC (`docs/sql/connect_v38_payout_accounting.sql`), wired into the payout-completion route, verified live. Zero real payouts had completed before the fix shipped, so no consultant was ever actually double-paid.
- ✅ **Ban alert pointed to `support@imotara.com`** — corrected to `info@imotara.com`.
- ✅ **Soft-launch institutional-gate bug on mobile** — fixed and **pushed** (no longer sitting in an unpushed branch); still needs a new EAS build to reach real devices.
- ✅ **`wallet-forfeit` cron** — removed entirely (was practically inert anyway; see Database & Backend Reference).
- ✅ **`user_bans` table being treated as authoritative** — the admin ban-status endpoint now reads `auth.users.banned_until` directly; `user_bans` is kept only as supporting context.
- ✅ **Jest test-suite + CI branch for imotara-mobile** — pushed to `main` (commits differ from the originally-drafted `d03dade`/`7889964` — they landed via `git am` as `ad80719`/`d0d2cdb`/`8e2a548`/`2cd6018`). CI is active on the remote.
- ✅ **Web `.env.example` gaps** (Azure TTS, Stripe, Apple IAP, Google Play, donation vars) — filled in.
- ✅ **Public web FAQ wrong languages** (Korean/Turkish/Italian) — corrected to the real 22-language list.
- ✅ **`eas.json`'s launch-flag env var mismatch** — code now reads `EXPO_PUBLIC_LAUNCH_CLOUD_SYNC_FREE_FOR_ALL` directly (matching what `eas.json` actually sets), and `eas.json`'s `production` value was corrected from `"false"` to `"true"` to match current soft-launch intent (everyone free for now; flip that one value later to turn on real enforcement).

**Confirmed FALSE ALARM, not a bug:** the "Web Settings content-sensitivity buttons mislabeled" item below was investigated and found incorrect — there are two separate, correctly-labeled controls (content guard Relaxed/Standard/Strict; crisis threshold Sensitive/Standard/Conservative) sitting next to each other. No change was made.

**Still genuinely open:**
- **iOS tip-jar SKU names don't match their real prices** (`donation_49` is really priced ~₹79, etc. — Apple's price-point localization, not a simple currency conversion). Deliberately **left as-is**: users are never shown the wrong number (the app always renders Apple's live `displayPrice`, never the SKU name), and Apple doesn't support renaming a live product ID — "fixing" it would mean provisioning new App Store Connect products and migrating, for a purely cosmetic internal-naming inconsistency. The code comment in `IOSTipJar.tsx` now documents this explicitly.
- "Coming soon" org features with UI present but not functional: LMS/iframe embed, referral commission tracking; NGO Impact Report is HTML, not PDF.
- `/reflect` redirects to `/grow`; mobile Settings offers only Google sign-in (no magic link on mobile).
- Help-chat rate limiting (`/api/help-chat`, added 2026-07-18) is being hardened from in-memory-per-instance to a DB-backed global cap (`docs/sql/help_chat_rate_limit.sql`) — same reasoning as the API-key rate limiter.

*Knowledge base generated 2026-07-17 from the repos at v1.2.7 (web commit `4281603`, mobile commit `9becac8`). 17 docs total: 11 reference + 5 playbooks + this index. When the code changes materially, update the affected doc rather than letting it drift — this index was refreshed 2026-07-18, but the body text of individual docs (payout mechanics, cron tables, env var lists) may still describe the pre-fix state in places; treat this index as the current source of truth until a full doc-by-doc refresh happens.*
