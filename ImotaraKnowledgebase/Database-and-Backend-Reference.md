# Imotara — Database & Backend Reference

*Operations and engineering reference for the Imotara web backend: Supabase Postgres, the hand-applied migration workflow, the full table catalog, the key SECURITY DEFINER RPCs and triggers, the RLS model, the complete `/api/**` route map, all scheduled cron jobs, and the environment-variable reference. Current as of v1.2.7.*

---

## 1. Supabase setup & the migration workflow

Imotara runs on **Supabase Postgres**. There is no Prisma-managed schema in production — `prisma/schema.prisma` is effectively empty; all tables are created by **68 hand-written SQL files in `docs/sql/`**, applied manually in the Supabase SQL Editor with the service-role (superuser) connection.

### How migrations are ordered

There is no migration runner. Ordering is **by naming convention and documented run-order**, not by a tool:
- Org files carry an explicit run order in their headers (`org_schema.sql` → `org_audit_log.sql` → `org_licenses_alter.sql` → `org_functions.sql`, then `org_license_pools.sql`, `org_phase2_features.sql`, fixes).
- Connect files are numbered `connect_schema.sql` → `connect_v2_features.sql` → `connect_v3…` → `connect_v37_…`. Apply in ascending version order.
- Wallet files: `imotara_wallet_migration.sql` → `imotara_wallet_v2_expiry.sql` → `imotara_wallet_v3_ultra_safe.sql`.

### Applying a migration safely

1. Read the file header — most declare prerequisites and run order.
2. Files are written to be **idempotent**: `create table if not exists`, `add column if not exists`, `create or replace function`, `drop policy if exists` before `create policy`. Re-running a file is generally safe.
3. Run in the Supabase SQL Editor as service-role. Later `connect_vNN` files frequently **`CREATE OR REPLACE`** an earlier function (e.g. `resolve_user_tier`, `increment_pending_payout`, `revoke_org_license`, `update_consultant_rating` all have multiple definitions across files) — **the highest-numbered / latest-applied definition is authoritative.** When reconstructing the schema, apply in order and let later files win.
4. `docs/CHANGELOG_v1.2.7.md` records exactly which SQL files were run for a given release (e.g. that release ran `api_key_rate_limit.sql`, `fix_pool_release_on_member_removal.sql`, `org_owner_race_lockdown.sql`). Use the changelog as the deployment record.

> **✅ RESOLVED 2026-07-18 — wallet forfeiture inconsistency.** `imotara_wallet_v2_expiry.sql` introduced a `forfeited` status and a forfeit path; `imotara_wallet_v3_ultra_safe.sql` then **removed** `forfeited` from the status CHECK (allowing only `active | dormant | refund_requested | refunded`) and states balances are *never* zeroed. The `wallet-forfeit` cron still tried to set `status='forfeited'` and `balance=0`, which would have violated the v3 CHECK constraint — it was never actually reachable in practice (`wallet-dormant` runs 30 minutes earlier and already converts the same wallets). **The cron entry was removed from `vercel.json` entirely** — the **dormant** policy (v3) is now the only path, with nothing superseded left sitting in the codebase.

---

## 2. Full table catalog (by domain)

### Core user data
| Table | Purpose | Key columns |
|---|---|---|
| `user_memory` | Per-user emotional context / facts / push subs / prefs | `user_id`, `type`, `key`, `value` (jsonb), `confidence` |
| `chat_messages` | Cloud-synced chat history | `user_id`, `thread_id`, `role`, `content`, `emotion`, `intensity`, `is_synced` |
| `user_profiles` | Connect user profile data (`connect_v12`) | `user_id`, profile fields |
| `usage_events` | Per-user event log powering the 20/day quota + org analytics | `user_id`, `event_type`, `emotion`, `created_at` |
| `donations` | Razorpay donation records | `amount_paise`, `razorpay_order_id`, `status` |
| `blog_comments` | Public blog comments | comment fields, moderation state |

### Org & licensing
| Table | Purpose | Key columns |
|---|---|---|
| `licenses` | One row per user — the personal license (also links org membership) | `user_id` (unique), `tier`, `status`, `expires_at`, `token_balance`, `source`, `external_ref`, `org_id` |
| `organizations` | One row per corporate/NGO/EDU/govt account | `name`, `slug` (unique), `billing_type`, `tier`, `status`, `seats_purchased`, `seats_used`, `owner_user_id`, `expires_at`, `org_settings` (jsonb) |
| `org_members` | User↔org membership | `org_id`, `user_id`, `role` (owner/admin/member), `status`, `override_tier` |
| `org_invites` | Pending email invites (token in link) | `org_id`, `email`, `role`, `token`, `expires_at`, `accepted_at` |
| `org_audit_log` | Immutable org action log | `org_id`, `actor_*`, `action`, `target_*`, `changes` (jsonb) |
| `org_license_pools` | Bulk license batches issued by super-admin to an org | `org_id`, `tier`, `quantity_total`, `quantity_used`, `expires_at`, `active` |
| `org_license_assignments` | Pool license → specific user (soft-deleted on withdraw) | `pool_id`, `org_id`, `user_id`, `tier`, `withdrawn_at` |
| `cohorts` / `cohort_members` | Classroom/team grouping (`org_phase2`) | `org_id`, membership |
| `referral_codes` / `referral_attributions` | Referral tracking (marked "coming soon" in UI) | codes, attributions |
| `api_keys` | Org API keys (`org_api_keys`) | hashed key, `org_id`, scopes |
| `api_key_rate_limits` | Global (DB-backed) API-key rate limiter | `key_id`, window counters |
| `payment_licenses` | Idempotency/audit — one row per gateway payment that granted a license | `payment_id` (PK), `user_id`, `product_id`, `tier`, `amount_paise`, `currency` |
| `payment_invoices` | Issued invoices (rendered as HTML) | `user_id`, `org_id`, `invoice_number`, `amount_paise`, `currency`, `payment_gateway`, `status`, `tier`, `period_*` |
| `admin_license_history` | Audit of manual admin license changes | old/new tier/status/expiry/tokens, `action`, `admin_label` |

### Super-admin
| Table | Purpose | Key columns |
|---|---|---|
| `super_admins` | Platform admins (not org admins) | `email` (unique), `password_hash` (scrypt `salt:hash`), `role` (owner/admin; `connect_reviewer` also used), `active`, `totp_enabled` |
| `admin_sessions` | Super-admin session tokens (SHA-256 hash only, 8h expiry) | `admin_id`, `token_hash`, `expires_at` |
| `admin_password_resets` | Admin password reset tokens | reset tokens |
| `admin_login_audit` | Admin login audit trail (`super_admins_security`) | login events |

### Connect (marketplace)
| Table | Purpose | Key columns |
|---|---|---|
| `connect_consultants` | Consultant profiles | `user_id`, `display_name`, `gender`, `photo_url`, `bio`, `expertise_tags[]`, `languages[]`, `rate_per_min`, `currency_code`, `status` (pending/approved/suspended/rejected), `is_online`, `is_busy`, `rating_avg`, `sessions_completed`, `availability_windows` (jsonb), `role_category`, `preferred_lang` |
| `connect_sessions` | Text-chat sessions + per-minute billing state | `user_id`, `consultant_id`, `type` (instant/scheduled), `status`, `rate_per_min` (locked at creation), `minutes_used`, `amount_charged`, `platform_fee`, `last_tick_at`, `scheduled_at`, `translation_enabled`, `rating`, `review_text` |
| `connect_messages` | Chat messages (Supabase Realtime-enabled) | `session_id`, `sender_id`, `content` (≤2000) |
| `connect_wallet` | Per-user pre-paid balance **and** per-consultant earnings (one row covers both) | `user_id` (PK), `balance_amount`, `earned_amount`, `pending_payout` |
| `connect_recharges` | Consultant-specific recharge payment records | `user_id`, `consultant_id`, `razorpay_order_id`, `amount`, `minutes_credited`, `platform_fee`, `consultant_credit`, `status` |
| `connect_payouts` | Consultant payout requests | `consultant_user_id`, `amount`, `payout_method` (upi/bank/paypal), `payout_details` (jsonb), `status`, `admin_note` |
| `connect_blocks` | Consultant blocks a user | `consultant_id`, `blocked_user_id` |
| `connect_favorites` | User bookmarks a consultant | `user_id`, `consultant_id` |
| `connect_session_notes` | Consultant's private per-session notes | `session_id`, `consultant_user_id`, `content` |
| `user_bans` | User ban records (`connect_v11`) | `user_id`, ban metadata |
| `app_settings` | KV store; holds `exchange_rates` (updated daily by cron) | `key` (PK), `value` (jsonb) |

### Wallet (unified INR wallet — distinct from `connect_wallet`)
| Table | Purpose | Key columns |
|---|---|---|
| `imotara_wallets` | Single INR balance per user + expiry/dormancy state | `user_id` (PK), `balance` (≥0), `last_activity_at`, `expires_at` (activity + 2yr), `status` (active/dormant/refund_requested/refunded), `dormant_at`, per-milestone `notified_*_at` |
| `imotara_wallet_transactions` | Ledger: topup / deduction / refund / dormancy_marked | `user_id`, `type`, `amount`, `session_id`, `razorpay_*` |
| `imotara_wallet_orders` | Pending Razorpay top-up orders | `user_id`, `razorpay_order_id` (unique), `amount`, `status` |
| `imotara_wallet_notifications` | Every wallet email ever sent (audit) | `user_id`, `notification_type`, `sent_at`, `delivery_status` |
| `imotara_wallet_consents` | Explicit consent record per top-up (terms version, IP, UA) | `user_id`, `terms_version`, `accepted_at` |
| `imotara_wallet_refund_requests` | Wallet refund requests | `user_id`, `amount`, bank/UPI fields, `status`, `reference_number` (unique) |

---

## 3. Key RPCs & triggers

All these are `SECURITY DEFINER` with `set search_path = public`, and `EXECUTE` is revoked from `public/anon/authenticated` and granted only to `service_role` — i.e. only server routes using the admin client can call them.

### Licensing / org RPCs
- **`resolve_user_tier(user_id)`** — the tier engine. Priority: pool assignment > member `override_tier` > org default (if higher) > personal license > free. Returns effective tier, source, org context, expiry, token balance, status. (Latest definition in `org_license_pools.sql`.)
- **`assign_org_license(user_id, org_id, actor_id, actor_role)`** — invite-accept path. **Locks the org row** (`FOR UPDATE`), rejects if org inactive/expired/**full** (`seats_used >= seats_purchased`), upserts the license (never downgrades a higher personal tier), increments `seats_used`, writes audit.
- **`revoke_org_license(user_id, org_id, …)`** — member removal. Latest version (`fix_pool_release_on_member_removal.sql`) also **withdraws any active pool assignment** and decrements the pool's `quantity_used` inline, then resets the license to free, decrements `seats_used` (floored at 0), marks the membership `removed`, writes audit.
- **`assign_pool_license` / `withdraw_pool_license`** — org admins assign/withdraw pool licenses; keep `quantity_used` and the `licenses` row in sync.
- **`check_org_seat_available(org_id)`** — boolean pre-check (seats free + active + not expired).
- **`tier_rank(text)`** — immutable ordering helper (`free`0…`enterprise`5).
- **`get_org_members`, `get_org_usage_stats`, `admin_search_orgs`, `admin_search_users_with_licenses`, `get_org_member_stats`, `get_org_license_inventory`** — dashboard/admin read helpers. `get_org_usage_stats` returns **aggregate-only** data (active users, event counts, a rough avg-session-mins proxy) — never individual rows.

### Connect / wallet / billing RPCs
- **`get_session_balance(user_id, consultant_id)`** — single-expression atomic balance read (kills the two-read TOCTOU window in billing).
- **`credit_imotara_wallet(user_id, amount, currency)`** — atomic `INSERT … ON CONFLICT DO UPDATE SET balance += amount` (top-up race fix).
- **`decrement_wallet_balance`**, **`increment_wallet_earnings`**, **`increment_pending_payout` / `decrement_pending_payout`** — atomic `+=`/`-=` money movements (prevent double-credit/double-payout).
- **`increment_sessions_completed(consultant_id)`** — atomic counter.
- **`update_consultant_rating()`** — trigger fn recomputing `rating_avg`/`rating_count` on review.

### Triggers
- **`trg_release_licenses_on_org_delete`** (BEFORE DELETE on `organizations`) — because `licenses.org_id` is `ON DELETE SET NULL` (not CASCADE), deleting an org would otherwise leave ex-members holding an org-derived paid tier forever. This trigger resets all affected licenses to free in the same transaction, regardless of what deleted the org.
- **License-pool release on member removal** — folded into `revoke_org_license` (above) so pool capacity is never permanently leaked when someone leaves.
- **`trg_wallet_expiry`** (BEFORE INSERT/UPDATE OF `last_activity_at` on `imotara_wallets`) — recomputes `expires_at = last_activity_at + 2 years`.
- **`trg_organizations_updated_at`, `trg_connect_consultants_updated_at`** — `updated_at` maintenance.

---

## 4. RLS model

The design splits tables into two enforcement classes:

- **User-facing tables have RLS on**, scoped to `auth.uid()`. Users can `SELECT` their own rows (`user_memory`, `chat_messages`, `licenses`, `usage_events`, `imotara_wallets` and its ledger, `connect_wallet`, `connect_recharges`, `connect_payouts`, `imotara_wallet_refund_requests`, etc.). Connect adds relationship-based policies: `connect_consultants` are publicly `SELECT`-able only when `status='approved'` (plus owner-all); `connect_sessions`/`connect_messages` are readable/writable only by the session's participants (user or the consultant's user), and message inserts require the session to be `active`. Org tables let members read their own membership/org and let owners/admins read all members/invites/pools for their org.
- **Admin-only tables have no RLS** and are reachable **only via the service-role key** from server routes: `super_admins`, `admin_sessions`, `admin_login_audit`. The pattern throughout is "no client-side writes — all mutations go through service-role API routes." Every SECURITY DEFINER RPC is likewise service-role-only.

Consequence: even though clients hold the anon key and talk to Supabase directly for reads, they cannot mutate money/tier/org state — those paths are exclusively server-mediated.

---

## 5. API route map (`/api/**`)

Grouped by area; one line each.

### AI / chat / history
- `POST /api/respond` — full orchestration (analyze + reply + reflection).
- `POST /api/chat-reply` — single GPT reply (SSE stream); **hosts the 20/day Free quota gate**.
- `POST /api/analyze` — emotion analysis (local or cloud).
- `GET/POST /api/chat/messages` — chat history CRUD.
- `GET/POST/DELETE /api/history`, `POST /api/history/sync` — emotion records + incremental sync.
- `GET/POST/DELETE /api/memory` — user memory CRUD.
- `POST /api/mindset-analysis`, `POST /api/pulse`, `GET /api/social-proof`, `POST /api/imotara-ai`, `POST /api/settings-search` — supporting AI/UX endpoints.
- `POST /api/tts` — Azure Neural TTS proxy. `POST /api/voice/transcribe` — STT.

### Account / data
- `POST /api/account/delete`, `POST /api/delete-remote` — account/data deletion.
- `POST /api/export` — GDPR data export (JSON/CSV). `POST /api/profile/sync` — profile prefs.
- `POST /api/careers/apply`, `GET/POST /api/blog/comments` — misc site.

### License & payments
- `GET /api/license/status` — effective tier resolution.
- `POST /api/license/order-intent` — create Razorpay license order.
- `POST /api/license/verify-payment` — Razorpay confirm + grant.
- `POST /api/license/verify-apple-purchase`, `POST /api/payments/google-play/verify` — mobile IAP verify + grant.
- `POST /api/license/seed` — seed free/trial license on sign-in.
- `POST /api/payments/donation-intent`, `GET /api/donations/recent` — donations.
- `POST /api/payments/razorpay/webhook` — Razorpay webhook (license/corporate/recharge/topup/donation/refund).
- `POST /api/payments/razorpay/corporate` — corporate seat Razorpay order.
- `POST /api/payments/stripe/checkout`, `POST /api/payments/stripe/webhook` — Stripe individual/corporate.
- `GET /api/invoice`, `GET /api/invoice/[invoiceId]` — invoice list / HTML render.
- `POST /api/subscription/cancel` — cancel at period end.

### Admin (super-admin; `_auth.ts`)
- `POST /api/admin/auth/{login,logout,seed,forgot-password,reset-password}`, `GET /api/admin/auth/{me,sessions}`, `2fa/{setup,verify,disable}` — admin auth + TOTP.
- `GET/POST /api/admin/licenses`, `/api/admin/licenses/[userId]`, `/api/admin/licenses/history` — manual license management.
- `GET/POST /api/admin/organizations`, `/[orgId]`, `/[orgId]/{members,analytics,audit,pools}` — org oversight.
- `GET/POST /api/admin/super-admins`, `/[id]`, `/[id]/unlock` — manage admins.
- `POST /api/admin/users/[userId]/ban`, `/recovery-link` — real Supabase ban / one-time recovery sign-in link.
- `GET/POST /api/admin/comments`, `/[id]`, `GET /api/admin/dashboard`.
- `/api/admin/connect/*` — see Connect doc (pending, approve, docs, consultants, active-sessions, earnings, payouts, refunds).

### Org (self-serve dashboard; `org/_auth.ts`)
- `POST /api/org/new`, `GET /api/org/invite/[token]`, `POST /api/org/join-by-domain`.
- `GET /api/org/dashboard` + subroutes: `members`, `members/bulk`, `analytics`, `audit`, `apikeys`, `branding`, `cohorts`, `cohorts/members`, `contracts`, `domain-verify`, `embed`, `license-inventory`, `pools`, `referrals`, `settings`, `sso`, `verification`.
- `GET /api/org/certificate`, `/certificate/impact-report`.
- `GET /api/v1/org/members`, `/api/v1/org/stats` — public org API (API-key auth).

### Connect
- Consultant & session & wallet routes — fully catalogued in the Connect doc.

### Push, health, cron
- `POST/DELETE /api/push/subscribe`, `GET /api/push/cron` — web push.
- `GET /api/health` — env-presence health check (no secret values).
- `/api/cron/*` — see §6.

---

## 6. Cron jobs (8 from `vercel.json` — was 9 before `wallet-forfeit` was removed 2026-07-18)

Every cron route is gated by **`CRON_SECRET`**. Most check `Authorization: Bearer <CRON_SECRET>` (Vercel Cron sends this); `exchange-rates` reads `x-cron-secret` header or `?secret=`. If `CRON_SECRET` is unset or mismatched → 401.

| Path | Schedule (UTC cron) | What it does |
|---|---|---|
| `/api/push/cron` | `0 9 * * *` (daily 09:00) | Sends scheduled web-push check-in notifications. |
| `/api/cron/exchange-rates` | `0 2 * * *` (daily 02:00) | Fetches INR exchange rates from `open.exchangerate-api.com`, stores in `app_settings.exchange_rates` (falls back to hardcoded rates on failure). |
| `/api/cron/connect-orphans` | `*/10 * * * *` (every 10 min) | Auto-completes active Connect sessions with no tick for >15 min (client crash), credits the consultant; skips scheduled sessions that are legitimately waiting. |
| `/api/cron/wallet-reminders` | `30 2 * * *` (daily) | Sends 6 milestone expiry reminders (180/90/30/14/7/1 days) + annual balance statements; each milestone tracked in a `notified_*_at` column to prevent duplicates. |
| `/api/cron/wallet-dormant` | `30 3 * * *` (daily) | Marks wallets inactive ≥2 years as `dormant` (balance **preserved**, refundable 1 year), logs an event, notifies the user. |
| `/api/cron/wallet-expiry-notice` | `0 3 * * *` (daily) | Sends a 30-day advance expiry warning to active wallets, sets `expiry_notified_at`. |
| ~~`/api/cron/wallet-forfeit`~~ | — | **Removed 2026-07-18** (was `0 4 * * *`). Used to attempt zeroing expired balances to `status='forfeited'`, conflicting with the v3 "never zero / dormant" policy — see §1. No longer in `vercel.json`; the cron table now has 8 entries, not 9. |
| `/api/cron/connect-scheduled` | `0 * * * *` (hourly) | Auto-cancels pending scheduled sessions whose `scheduled_at` passed >2h ago; notifies the user via push. |
| `/api/cron/connect-recharge-expiry` | `*/30 * * * *` (every 30 min) | Marks abandoned `connect_recharges` (`pending` >30 min) as `failed`, clearing the partial-unique-index that would otherwise block new recharges for that user+consultant pair. |

---

## 7. Environment variable reference

From `.env.example` plus vars discovered in code that are **not** in the example (marked ⚠ gap).

> **✅ RESOLVED 2026-07-18**: all ⚠-marked gaps below (Azure TTS, Stripe, Apple IAP, Google Play, donations) were added to `.env.example` in the KB-audit fix pass. The ⚠ markers are kept here as a historical record of what used to be missing, not a current gap.

### Supabase
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.

### App / auth / licensing
`NEXTAUTH_URL`, `NEXTAUTH_SECRET` (NextAuth is legacy/superseded by Supabase Auth), `NEXT_PUBLIC_IMOTARA_API_BASE_URL`, `NEXT_PUBLIC_IMOTARA_ANALYSIS`, `NEXT_PUBLIC_IMOTARA_VERSION`, `NEXT_PUBLIC_APP_VERSION`, `NEXT_PUBLIC_IMOTARA_LICENSE_MODE` (`off`), `NEXT_PUBLIC_IMOTARA_LAUNCH_DATE`, `NEXT_PUBLIC_IMOTARA_FREE_DAYS` (120), `NEXT_PUBLIC_IMOTARA_LICENSE_TIER` (QA override).

### AI
`OPENAI_API_KEY`, `IMOTARA_AI_MODEL` (`gpt-4.1-mini`), `IMOTARA_OPENAI_BASE_URL`. Gemini fallback is REST-based (key referenced in AI client). 

### Payments
- Razorpay: `IMOTARA_DONATION_ENABLED`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `NEXT_PUBLIC_RAZORPAY_KEY_ID`, `RAZORPAY_CONNECT_KEY_SECRET`.
- Stripe ⚠ (in `stripeClient.ts`, absent from `.env.example`): `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, and one `STRIPE_PRICE_{PRODUCTID}` per subscription/token product (e.g. `STRIPE_PRICE_PLUS_MONTHLY`), `NEXT_PUBLIC_SITE_URL`.
- Apple IAP ⚠: `APPLE_IAP_ISSUER_ID`, `APPLE_IAP_KEY_ID`, `APPLE_IAP_PRIVATE_KEY`.
- Google Play ⚠: `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`, `GOOGLE_PLAY_PACKAGE_NAME` (default `com.imotara.imotara`).

### Voice / TTS ⚠ (not in `.env.example`)
Azure Speech is **multi-region**, selected by the caller's country. `regionRouter.ts` reads **`AZURE_SPEECH_KEY_<SUFFIX>`** and **`AZURE_SPEECH_REGION_<SUFFIX>`** per region suffix (with an India-region default). The TTS route calls `https://<region>.tts.speech.microsoft.com/...` with `Ocp-Apim-Subscription-Key`.

### Push, email, cron, admin
- Web Push: `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`.
- Cron: `CRON_SECRET`.
- Email (nodemailer over Hostinger/Gmail SMTP, port 465): `SMTP_HOST` (default `smtp.hostinger.com`), `ALERT_GMAIL_USER`, `ALERT_GMAIL_APP_PASSWORD`, `CONNECT_PLATFORM_EMAIL` (default `info@imotara.com`).
- Admin: `ADMIN_SECRET_DISABLED` (set `true` in prod to kill the legacy Bearer fallback), `ADMIN_SECRET` (legacy emergency key).

### Admin auth model
Two modes (`src/app/api/admin/_auth.ts`): the preferred **super-admin session cookie** (scrypt-hashed passwords in `super_admins`, SHA-256 session tokens in `admin_sessions`, 8h expiry, optional TOTP) and the legacy **`ADMIN_SECRET` Bearer** fallback (timing-safe compare, disabled when `ADMIN_SECRET_DISABLED=true`). There's a scoped **`connect_reviewer`** role: allowed on `/api/admin/connect/*` (via `connectAdminAuthorized`) but blocked from general admin routes and from approving consultants.
