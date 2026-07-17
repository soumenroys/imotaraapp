# Imotara Connect — Consultant Marketplace

*Reference for Imotara Connect: the human-companion marketplace layered onto Imotara. Covers the user-side booking + per-minute wallet billing flow, the two wallet systems, consultant onboarding and earnings, session lifecycle and crons, moderation/admin, safety, and support answers. Grounded in `src/app/api/connect/**`, `src/lib/connect/**`, `src/lib/wallet/**`, `src/app/connect/**`, and the `connect_*` / `imotara_wallet_*` SQL. Current as of v1.2.7.*

> **Status.** Connect ships as working code (37 numbered `connect_v*` migrations, live API routes, `/connect` pages, Realtime chat, Vercel crons) but was originally scoped as the v1.2 MVP and parts of the "full vision" remain aspirational. Sessions are **text chat** today (consultants may register interest in audio/video, but the billed session is text). Available on **all consumer tiers** — the only tier difference is session-history retention.

---

## 1. What Connect is

Connect lets a user have a real-time **text session** with a verified human "wellness companion," billed **per minute** from a prepaid wallet. It is explicitly **non-clinical**. Consultants set their own per-minute rate and currency; Imotara takes a **20% platform fee** at recharge time (the consultant is credited 80%).

Two distinct wallet systems exist — don't confuse them:
- **`imotara_wallets`** — the unified per-user INR balance (topped up generically), with 2-year expiry/dormancy rules and refund handling.
- **`connect_wallet`** — a per-user/per-consultant construct that also holds **consultant earnings** (`earned_amount`, `pending_payout`). Session balances for a specific consultant are tracked via `connect_recharges` and read atomically by `get_session_balance(user, consultant)`.

---

## 2. User-side flow

### 2.1 Browsing
- Web `/connect` (and mobile Connect tab). Consultants are publicly visible only when `status='approved'` (enforced by RLS). Listing shows specialty tags, languages, rating, per-minute rate, online status. `GET /api/connect/consultants` lists; `GET /api/connect/consultants/[id]` is detail.
- **Favorites**: `GET/POST/DELETE /api/connect/favorites` (`connect_favorites`, unique per user+consultant).

### 2.2 Age gate (18+)
Connect is 18+. The client records the user's confirmation via **`PATCH /api/connect/user/age-gate`** `{ restricted: boolean }`, which writes `connect_age_restricted` into Supabase `user_metadata`. **Server-side enforcement**: `POST /api/connect/sessions` rejects with 403 if `user.user_metadata.connect_age_restricted === true`. Users who self-identify as under 18 are routed to `/connect/age-restricted`.

### 2.3 Starting a session — `POST /api/connect/sessions`
Auth required (`getConnectUser`: Bearer or cookie). Validations, in order:
- Age gate (above).
- `type` ∈ `instant | scheduled`; scheduled requires a message + a valid future `scheduled_at` (≥60s ahead, ≤90 days out), plus a duration.
- **Rate limit**: max 10 session creates per user per 10 min.
- No duplicate open session with the same consultant; **only one active/pending session at a time** across all consultants.
- Consultant must be `approved`; for `instant`, must be `is_online`; must not be `is_busy`.
- Scheduled: true interval-overlap check against the consultant's other bookings (looks back 8h to catch long sessions).
- Not **blocked** by the consultant (`connect_blocks`); can't book **your own** consultant profile.
- **Requires ≥1 minute of pre-paid balance** for that consultant (`get_session_balance`), else 402 `needs_recharge`.
- Translation opt-in bakes a **+10% surcharge** into the locked `rate_per_min` when the user and consultant languages differ.

On success a `pending` session is created with the rate **locked at creation** (so later rate changes don't affect an in-flight session), and the consultant is notified by Expo push. The consultant accepts (→ `accepted`/`active`).

### 2.4 Per-minute billing — `POST /api/connect/sessions/[id]/tick`
The client calls tick **every 60s** during an active session; the server is authoritative:
- Rejects ticks <55s apart (429 `tick_too_soon`).
- Reads the **locked** `rate_per_min`; computes available balance atomically via `get_session_balance`.
- If balance ≤ 0 → auto-completes the session (path C). Otherwise deducts 1 minute, updates `minutes_used`/`amount_charged`/`platform_fee`; if that hits zero → auto-completes (path B).
- Every write uses an **optimistic lock** on `minutes_used` + `status='active'` so concurrent ticks can't double-charge or double-credit.
- On completion it credits the consultant (`creditConsultant`): 80% of `minutes_used × rate` to `connect_wallet.earned_amount` via `increment_wallet_earnings`, increments `sessions_completed`, clears `is_busy`, and fires three emails (user statement, consultant earnings with the 80/20 split, platform revenue notice to Imotara).

### 2.5 In-session extras
- **Messages**: `GET/POST /api/connect/sessions/[id]/messages` (Realtime-enabled `connect_messages`; inserts require the session to be `active`).
- **Translate**: `POST /api/connect/translate` — real-time message translation when the user/consultant languages differ (drives the +10% surcharge).
- **Balance check**: `GET /api/connect/sessions/[id]/balance`.
- **Review**: `POST /api/connect/sessions/[id]/review` — 1–5 stars + ≤200-char text after the session ends (triggers `update_consultant_rating`).
- **Notes**: `GET/POST /api/connect/sessions/[id]/notes` — the *consultant's* private notes (`connect_session_notes`, RLS-scoped to the consultant).
- **Blocks**: `GET/POST/DELETE /api/connect/blocks` — a consultant blocks a user.

---

## 3. Wallet (top-up, expiry, refunds, consent)

### 3.1 Top-up (unified INR wallet)
- **`POST /api/connect/wallet/topup/create`** → creates an `imotara_wallet_orders` (pending) + Razorpay order.
- **`POST /api/connect/wallet/topup/verify`** `{ razorpay_order_id, razorpay_payment_id, razorpay_signature }` → verifies the HMAC signature, marks the order `completed` (atomic `.eq('status','pending')` idempotency gate), credits the wallet via **`credit_imotara_wallet`** RPC (atomic `balance +=`), logs a `topup` transaction, and **resets the inactivity clock** (`updateWalletActivity`).
- Webhook backstop: if the browser dies after payment, the Razorpay webhook detects the `imotara_wallet_orders` row and credits via the same RPC.

### 3.2 Consultant-specific recharge
- **`POST /api/connect/wallet/recharge/create`** `{ consultant_id, minutes }` → prices `rate_per_min × minutes` in the consultant's currency, converts to INR using `app_settings.exchange_rates` (never silently falls back to 1:1 for foreign currencies), splits 20/80, creates a Razorpay order + a `pending` `connect_recharges` row. A partial-unique index blocks a second pending recharge for the same user+consultant (409). Min ₹1, max ₹5,00,000 per order.
- **`POST /api/connect/wallet/recharge/verify`** → confirms and credits minutes.
- **`GET /api/connect/wallet`** and **`GET /api/connect/wallet/history`** — balance + transaction history.

### 3.3 Expiry, dormancy & forfeiture
Governed by the `imotara_wallets` v2/v3 migrations and four wallet crons:
- `expires_at = last_activity_at + 2 years`, refreshed by a trigger on activity.
- **Reminders** (`wallet-reminders`, daily): 180/90/30/14/7/1-day milestone emails + annual statements, each tracked to avoid duplicates. Plus a dedicated 30-day notice (`wallet-expiry-notice`).
- **Dormancy** (`wallet-dormant`, daily): after 2 years inactive, wallet → `dormant`. **Balance is preserved, never zeroed**, and remains **refundable for 1 year** after dormancy (rationale cited in code: India's Consumer Protection Act 2019; Imotara's closed-loop wallet is PPI-exempt but honours consumer rights).
- **Forfeiture** (`wallet-forfeit`, daily): a *legacy/superseded* path that tries to zero balances to `status='forfeited'`. The v3 "ultra-safe" migration removed `forfeited` from the allowed statuses and enshrined "never zero." Treat the **dormant** policy as the live one; the forfeit cron is de-scoped and inconsistent with the current schema.

### 3.4 Consent records
Each top-up is meant to capture an `imotara_wallet_consents` row (terms version, accepted-at, amount, order ID, IP, user agent). Wallet terms live at `/connect/wallet-terms`.

### 3.5 Refund requests — `POST /api/connect/wallet/refund-request`
- Requires a positive balance; allowed for `active` or `dormant` wallets; dormant refunds honoured only within the **1-year grace period** after `dormant_at` (missing `dormant_at` → directed to support).
- Accepts bank details (account + IFSC + holder) **or** a UPI ID; rejects duplicate pending requests.
- Inserts an `imotara_wallet_refund_requests` row with a generated `reference_number` (`IMW-…`), flips wallet status to `refund_requested`, and emails both the user (confirmation) and `support@imotara.com` (action-required, "process within 7 business days"). `GET` returns the user's recent requests.

---

## 4. Consultant side

### 4.1 Applying — `POST /api/connect/consultant/register`
Auth required. Extensive validation: `display_name` (≤100), `gender` male/female, `role_category` (wellness_companion / friend / dad / mom / sister / brother / grandfather / grandmother / yoga_instructor / fitness_companion — defaults to wellness_companion), `bio` (≤500), 1–20 `expertise_tags`, 1–20 `languages`, `rate_per_min` (>0, ≤10,000), `currency_code` (INR/USD/EUR/GBP/AED/SGD/AUD), `session_types` (chat/audio/video — filtered), optional `availability_windows` (validated day/month/HH:MM/timezone shape), and **`coc_agreed` must be true** (Code of Conduct). URLs must be `https://`. Uploaded verification-doc paths must belong to the applicant (`${user.id}/…`) — you can't reference another user's private document.

Creates a `connect_consultants` row in `status='pending'`, ensures a `connect_wallet` row exists, and fires two emails (admin notification + applicant "received, 1–3 business days"). Duplicate applications return 409.

### 4.2 Document / photo upload
- **`POST /api/connect/upload-doc`** — verification documents (ID, credentials) to Supabase Storage, path-scoped to the user.
- **`POST /api/connect/upload-photo`** — profile photo (must resolve to an `https://` URL).

### 4.3 Approval
- Admin reviews at `/admin → Connect`. **`PATCH /api/admin/connect/[id]/approve`** `{ action: "approve" | "reject", reason?, approval_note? }`. Only `owner`/`admin` may approve — `connect_reviewer` is explicitly blocked from approving. Idempotent; sends a warm approval email (or a rejection email with the reason). Approval flips `status → approved`, making the consultant publicly visible.

### 4.4 Earnings & payouts
- **`GET /api/connect/consultant/earnings`** — `connect_wallet.earned_amount` / `pending_payout` and history. Earnings accrue at session completion (80% of billed).
- **`GET/POST /api/connect/consultant/payout`** — request a payout. Min **₹500** (or **$10** for USD); currency must match the earnings currency; method `upi | bank | bank_in | bank_int | paypal` (normalised to upi/bank/paypal for storage) with allowlisted, format-validated details (UPI `name@bank`, 8–18-digit account, `XXXX0XXXXXX` IFSC, valid PayPal email). Guards against double-payout via a pending-request check, a post-insert duplicate-count self-cancel, and the atomic **`increment_pending_payout`** RPC. Creates a `pending` `connect_payouts` row and emails the admin.
- **`GET/PUT /api/connect/consultant/profile`**, **`/status`** (online toggle, availability), **`/sessions`** (consultant's session list).

---

## 5. Session lifecycle & crons

| Stage | Trigger |
|---|---|
| Created (`pending`) | `POST /api/connect/sessions` (needs balance, passes all guards) |
| Accepted → `active` | Consultant accepts (`PATCH /api/connect/sessions/[id]`) |
| Billing | `tick` every 60s deducts a minute; auto-completes at zero balance |
| Completed | tick path B/C, or PATCH complete; consultant credited, `is_busy` cleared |
| Orphan cleanup | `connect-orphans` cron (every 10 min) completes active sessions with no tick >15 min |
| Stale scheduled cleanup | `connect-scheduled` cron (hourly) cancels pending scheduled sessions >2h past their time |
| Stale recharge cleanup | `connect-recharge-expiry` cron (every 30 min) fails `pending` recharges >30 min old |

Scheduled sessions can be booked up to 90 days ahead; the orphan cron deliberately does **not** kill a scheduled session that's simply waiting for its start time.

---

## 6. Moderation / admin

`/api/admin/connect/*` (auth via super-admin session or, for read/scoped actions, the `connect_reviewer` role via `connectAdminAuthorized`):
- **`pending`** — queue of applications awaiting review.
- **`[id]`**, **`[id]/docs`** — consultant detail + signed URLs for their verification docs.
- **`[id]/approve`** — approve/reject (owner/admin only; not `connect_reviewer`).
- **`consultants`** — list/manage; approve, **suspend** (`status='suspended'`), reject.
- **`active-sessions`** — live session monitor.
- **`earnings`** — platform revenue view.
- **`payouts`, `payouts/[id]`** — process/deny consultant payout requests.
- **`refunds`** — process wallet refund requests.

The `connect_reviewer` role exists so document/queue review can be delegated without granting full platform-admin powers or approval authority. (A v1.2.7 fix closed a privilege-escalation hole where a Connect reviewer could unban/read any ban record.)

---

## 7. Safety

- **18+ only**, enforced both client-side (age gate UI, `/connect/age-restricted`) and server-side (`connect_age_restricted` metadata → 403 on session creation).
- **Non-clinical** positioning throughout; the intended full spec includes an emergency/crisis button routing to regional hotlines (aspirational per the plan docs).
- **Blocks**: consultants can block users (`connect_blocks`); blocked users can't book that consultant.
- **Bans**: platform-level `user_bans` + real Supabase-level bans that block sign-in/session refresh (made functional in v1.2.7 — previously an inert flag).
- **Rate limits** on session creation (10/10 min) and ticks (min 55s) curb abuse and push-spam.

---

## 8. Support answers

**"My recharge expired / a payment is stuck as pending."** Razorpay auto-expires unpaid orders after ~15 min; the `connect-recharge-expiry` cron marks abandoned `connect_recharges` as `failed` after 30 min, which also clears the block preventing a fresh recharge for that companion. If money left the account but no minutes were credited, the Razorpay webhook backstop should auto-complete it — check `connect_recharges`/`imotara_wallet_orders` for the order ID; if still stuck, escalate with the Razorpay payment ID.

**"My wallet balance expired."** Balances go **dormant** after 2 years of inactivity but are **never zeroed** — the full amount is preserved and refundable for **1 year** after dormancy. The user can submit a refund request in-app (`/api/connect/wallet/refund-request`) or email `support@imotara.com`. Any top-up or session resets the 2-year clock. (Ignore any "forfeited" language — that path is superseded by the never-zero policy.)

**"The consultant didn't show / I got billed for a session that dropped."** Billing is server-authoritative and per-minute — a user is only charged for minutes actually ticked. If the client crashed, the `connect-orphans` cron closes the session within ~15 min and only bills elapsed minutes. A no-show on a *scheduled* session is auto-cancelled by the `connect-scheduled` cron after 2 hours with no charge. For a genuine over-charge, admins can process a wallet refund via `/api/admin/connect/refunds`.

**"How do refunds work?"** Two kinds: (1) **wallet refunds** — for dormant/unused prepaid balance, requested in-app with bank/UPI details, processed manually within ~7 business days (reference number `IMW-…`); (2) **payment refunds** on Razorpay flow back through the `refund.processed` webhook, which marks the related `connect_recharges` row `refunded`. Session minutes already consumed are not refundable since a real person was paid for that time.

**"How do I become a companion?"** Register at `/connect/register`: profile, bio (≤500 chars), expertise tags, languages, per-minute rate + currency, upload verification documents, agree to the Code of Conduct. Applications are reviewed in 1–3 business days; you'll get an approval or rejection email. Once approved, set availability and go online to receive session requests. Earnings are 80% of billed minutes; request payouts (min ₹500 / $10) once earnings accrue.

---

I've grounded every section in the actual code and migrations. Three notable honesty flags worth surfacing to whoever consumes this knowledge base:

1. **Only the 20/day Free quota is hard-enforced** — all other tier gates are dormant behind `LICENSE_MODE=off` + the launch offer.
2. **The wallet-forfeit cron is inconsistent with the v3 schema** (which removed the `forfeited` status and mandates "never zero balance"); the dormant policy is the live one.
3. **Several env vars are missing from `.env.example`** — Stripe (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_*`), Apple IAP, Google Play, and multi-region Azure Speech (`AZURE_SPEECH_KEY_<SUFFIX>` / `AZURE_SPEECH_REGION_<SUFFIX>`) all appear only in code.
