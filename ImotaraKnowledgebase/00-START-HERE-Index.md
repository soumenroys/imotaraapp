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

## Known open items & findings (as of 2026-07-17)

**Code bugs / issues found while building this KB (worth fixing):**
- ⚠️ **Connect payout accounting hole:** completing a payout releases the pending hold but never debits `earned_amount`, so the same lifetime earnings become withdrawable again after each payout (`connect_v17`/`connect_v34`; no `paid_out` column). Needs a fix + reconciliation.
- **Web Settings content-sensitivity buttons mislabeled:** values are `relaxed/standard/strict` but labels render both "relaxed" and "strict" as "Conservative"; no "Sensitive" label ever shows (`settings/page.tsx` ~line 4010).
- **Ban alert points to `support@imotara.com`** while all other channels use `info@imotara.com` — appeals may hit an unmonitored inbox.
- **Soft-launch institutional-gate bug on mobile** (bypass revoked MULTI_PROFILE/CHILD_SAFE_MODE/ADMIN_DASHBOARD from real Family/EDU/Enterprise users) — FIXED in the unpushed `test/safety-net` branch.
- **`wallet-forfeit` cron is practically inert** (runs after wallet-dormant converts the same wallets; blocked by a CHECK constraint) — should be disabled.
- **iOS tip-jar SKU names don't match their prices** (`donation_49` ≈ ₹79 etc.).
- **`user_bans` table is audit-only** — `auth.users.banned_until` is authoritative; a ban set directly in Supabase leaves no `user_bans` row.

**Operational open items:**
- The **Jest test-suite + CI branch for imotara-mobile** (`test/safety-net`, 82 tests, version-sync check, GitHub Actions) exists as patch files but is **not yet pushed** to GitHub.
- Web `.env.example` is missing the Azure TTS and Stripe variable names used in code.
- The public web FAQ lists wrong example languages (Korean/Turkish/Italian); authoritative 22-language list is in the Product Overview. Live pricing (Plus ₹99 / Pro ₹149) differs from some marketing collateral (₹79).
- `eas.json`'s `EXPO_PUBLIC_LAUNCH_CLOUD_SYNC_FREE_FOR_ALL` var is **not** what mobile code reads — it derives the override from `EXPO_PUBLIC_IMOTARA_LAUNCH_DATE`/`FREE_DAYS` (release-day trap; Release Runbook B2).
- "Coming soon" org features with UI present but not functional: LMS/iframe embed, referral commission tracking; NGO Impact Report is HTML, not PDF.
- `/reflect` redirects to `/grow`; mobile Settings offers only Google sign-in (no magic link on mobile).

*Knowledge base generated 2026-07-17 from the repos at v1.2.7 (web commit `4281603`, mobile commit `9becac8`). 17 docs total: 11 reference + 5 playbooks + this index. When the code changes materially, update the affected doc rather than letting it drift.*
