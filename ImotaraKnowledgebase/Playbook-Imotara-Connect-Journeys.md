# Playbook — Imotara Connect Journeys

*Step-by-step, code-verified journeys for Imotara Connect (the human-companion marketplace). This is the operational companion to "Imotara Connect (Consultant Marketplace)" — that doc explains the architecture; this one walks each actor through the screens, buttons, endpoints, statuses, DB writes, and notifications, in order. Grounded in `src/app/api/connect/**`, `src/app/connect/**`, `src/lib/connect/**`, `src/app/api/cron/**`, the mobile `ConnectScreen`/`UpgradeSheet`, and the `connect_*` / `imotara_wallet_*` SQL. Where the reference doc already covers a topic, this goes deeper. Discrepancies I found against the reference doc are called out inline with **⚠ CORRECTION** / **⚠ FINDING**.*

---

## User Journey A — First instant session (browse → wallet → session → review)

### A1. Age gate (18+)
1. On first Connect open, the client asks the user to confirm they are 18+.
2. The answer is persisted via **`PATCH /api/connect/user/age-gate`** `{ restricted: boolean }`. The route calls `supabase.auth.admin.updateUserById` writing `user_metadata.connect_age_restricted`.
3. A user who says they are under 18 is routed to **`/connect/age-restricted`** and `connect_age_restricted` is set `true`.
4. **Behind the scenes / server enforcement:** every `POST /api/connect/sessions` re-reads `user.user_metadata.connect_age_restricted`; if `true` it returns **403** before any other check. The gate is not just client UI.

### A2. Browse & search consultants
1. The Connect landing (`/connect`, mobile Connect tab) calls **`GET /api/connect/consultants`** — public, no auth required.
2. Only `status='approved'` rows are returned, ordered **`is_online` desc, then `rating_avg` desc**. Pagination: `page`, `limit` (default 20, max 50).
3. Filters (query params): `gender`, `tag` (matches `expertise_tags`), `lang` (matches `languages`), `online=true`, `category` (`role_category`).
4. **What a profile card shows** (selected columns): `display_name`, `gender`, `photo_url`, `bio`, `expertise_tags`, `languages`, `role_category`, `session_types`, `rate_per_min` + `currency_code` (and `rate_per_min_inr`), `availability_note`/`availability_windows`, `is_online`, `is_busy`, `rating_avg`, `rating_count`, `sessions_completed`, `preferred_lang`.
5. **Behind the scenes for signed-in users:** the route (a) looks up `connect_blocks` where `blocked_user_id = you` and **removes consultants who have blocked you** (fail-closed — if the block lookup errors, the whole list 500s rather than leak); (b) attaches **`balance_minutes` per consultant** = completed `connect_recharges.minutes_credited` − `connect_sessions.minutes_used` (completed+active), so the UI can show "you already have N paid minutes with this companion."
6. Detail view: **`GET /api/connect/consultants/[id]`**.

### A3. Add a favorite
1. Heart/star on a card → **`POST /api/connect/favorites`** `{ consultant_id }`. Validates the consultant is `approved`; caps at **100 favorites** (429 beyond).
2. Row upserted into `connect_favorites` (unique `user_id,consultant_id`). Remove = **`DELETE`**; list = **`GET`** (which joins `connect_consultants` and hides `status='deleted'` consultants so browse cards don't break).

### A4. Top up the unified INR wallet
1. In the wallet tab the user enters an amount and must tick **accept Wallet Terms** (`/connect/wallet-terms`).
2. **`POST /api/connect/wallet/topup/create`** `{ amount, terms_accepted: true }`. Guards: `terms_accepted` required; amount **₹1–₹50,000**; max **3 pending** `imotara_wallet_orders` (429 otherwise).
3. Creates a Razorpay order + a `pending` `imotara_wallet_orders` row, then **records consent BEFORE payment** via `recordWalletConsent` into `imotara_wallet_consents` (terms version, amount, order id, **IP + user-agent**) — deliberately written pre-payment for an irrefutable audit record.
4. The client opens the **Razorpay checkout sheet** with the returned `razorpay_order_id` + `razorpay_key_id`.
5. On success the client calls **`POST /api/connect/wallet/topup/verify`** `{ razorpay_order_id, razorpay_payment_id, razorpay_signature }`.
6. **Behind the scenes:** HMAC-SHA256 signature check (timing-safe) → mark order `completed` with the atomic idempotency gate `.eq('status','pending')` (2nd concurrent verify matches 0 rows, returns idempotent) → **`credit_imotara_wallet` RPC** (`balance += amount`, atomic) → log `imotara_wallet_transactions` type `topup` → **`updateWalletActivity`** resets the 2-year inactivity clock.
7. **Failure/backstop:** if the browser dies after payment, the Razorpay webhook (`payment.captured`/`order.paid`) finds the `imotara_wallet_orders` row by `order_id` and credits via the same RPC (see Payments playbook §Diagnostics).

> Note: topping up the **unified INR wallet** is separate from buying **per-consultant minutes** (§A5). Instant sessions require pre-paid *minutes for that specific consultant* (`get_session_balance`), which come from `connect_recharges`, not from the generic `imotara_wallets` balance.

### A5. Buy session minutes for a consultant (recharge)
1. From a consultant profile the user picks a number of minutes → **`POST /api/connect/wallet/recharge/create`** `{ consultant_id, minutes }` (minutes must be a whole number **1–1000**).
2. Server prices `rate_per_min × minutes` in the **consultant's currency**, converts to INR using `app_settings.exchange_rates` (falls back to a hardcoded table; **never silently 1:1** for foreign currencies — a missing rate returns 503), splits **20% platform / 80% consultant**, and inserts a `pending` `connect_recharges` row (`amount`, `amount_inr`, `minutes_credited`, `platform_fee`, `consultant_credit`).
3. Guards: min ₹1 (`amountPaise ≥ 100`), max **₹5,00,000**; a partial unique index `uq_connect_recharges_user_consultant_pending` blocks a **second pending recharge** for the same user+consultant (409).
4. Razorpay sheet → **`POST /api/connect/wallet/recharge/verify`**. Signature check → atomic `.eq('status','pending')` completion gate → `completed_at` → **`createInvoice`** (`product_id='connect_session_minutes'`, uses the locked `amount_inr`) → `sendRechargeInvoiceEmail`.
5. **Behind the scenes:** the paying user's minutes are tracked purely in `connect_recharges`; **`connect_wallet` is the consultant earnings ledger and is NOT written for the buyer.** `get_session_balance(user, consultant)` reads credited − used atomically.

### A6. Start the instant session
1. User taps "Start session" → **`POST /api/connect/sessions`** `{ consultant_id, type: "instant", user_lang?, translation_requested?, user_timezone? }`.
2. Server checks, in order: age gate (403) → consultant_id is a UUID → rate-limit **max 10 creates / 10 min** (429) → no existing `pending`/`active` session with this consultant (409) → **no `pending`/`active` session with ANY other consultant** (409, "end it first") → consultant is `approved` → **`is_online`** (instant only, else 409 "offline") → not `is_busy` (409) → not blocked by consultant (403) → not your own profile (403) → **`get_session_balance ≥ 1` minute else 402 `needs_recharge`**.
3. **Translation opt-in:** if `translation_requested` and `user_lang ≠ consultant.preferred_lang`, a **+10% surcharge** is baked into `rate_per_min` at creation (`base_rate_per_min` stores the pre-surcharge rate).
4. Row inserted `status='pending'` with the **rate locked at creation** (later rate changes don't affect an in-flight session).
5. **Notifications:** confirmation email to the user (`sendSessionRequestEmail`) + **Expo push to the consultant** ("New Session Request") if they have `expo_push_token`.
6. Consultant accepts → **`PATCH /api/connect/sessions/[id]`** `{ action: "accept" }` (consultant-only). Guards re-check `is_busy` and re-confirm `status='approved'` at accept time (a consultant suspended between request and accept gets 403). Sets `status='active'`, `started_at`, `is_busy=true`; a partial unique index `uq_connect_sessions_consultant_active` blocks accepting two sessions at once (409). **User is notified** by email (`sendSessionAcceptedEmail`) + push ("Session Accepted!").

### A7. Per-minute billing, minute by minute
1. Once active, the client calls **`POST /api/connect/sessions/[id]/tick`** every **60s**. The server is authoritative.
2. Ticks arriving **<55s** after the last are rejected (**429 `tick_too_soon`**).
3. Each tick reads the **locked `rate_per_min`** and computes balance via **`get_session_balance` RPC** (single atomic SQL expression — no TOCTOU window).
4. **Path C (balance ≤ 0 at read):** auto-complete now — `status='completed'`, `ended_at`, `platform_fee = amount × 0.20`; then credit consultant. Returns `remaining_minutes: 0`.
5. **Path B (deduct drives remaining ≤ 0):** `minutes_used += 1`, `amount_charged = minutes_used × rate`, auto-complete + credit.
6. **Path A (normal):** `minutes_used += 1`, `amount_charged` updated, `last_tick_at` set. Returns `remaining_minutes`.
7. Every write uses an **optimistic lock**: `.eq('status','active').eq('minutes_used', <value read>)`. A concurrent tick that already incremented matches 0 rows → no double-charge, no double-credit.
8. **On completion (`creditConsultant`):** upsert `connect_wallet` for the consultant → **`increment_wallet_earnings` RPC** credits **80% of `minutes_used × rate`** to `earned_amount` → write `consultant_credited` (only after the credit succeeds — no false audit record) → **`increment_sessions_completed` RPC** → **`is_busy=false`** → three fire-and-forget emails: user session statement, consultant earnings (shows the 80/20 split), and **platform revenue notice to Imotara**.

### A8. In-session extras
- **Chat:** `GET/POST /api/connect/sessions/[id]/messages` (Realtime `connect_messages`; inserts require `status='active'`).
- **Translate:** `POST /api/connect/translate` `{ text, targetLang, sourceLang? }` — auth-gated (prevents open-proxy abuse), **rate-limited 60 requests / 60s per user**, backed by MyMemory (free) or Google Cloud Translation if a key is set.
- **Balance check:** `GET /api/connect/sessions/[id]/balance`.

### A9. End the session
- **User ends:** `PATCH /api/connect/sessions/[id]` `{ action: "userEnd" }` (user-only, `active → completed`).
- **Consultant ends:** `{ action: "complete" }` (consultant-only, `active → completed`).
- Either path credits the consultant using the **fresh `minutes_used` from the `RETURNING` clause** (a concurrent tick may have incremented it), writes `amount_charged`/`platform_fee`/`consultant_credited`, increments `sessions_completed`, clears `is_busy`, and fires the same three emails.
- Pending sessions instead: user `{ action: "cancel" }` (`pending → cancelled`, pushes consultant) or consultant `{ action: "decline" }` (`pending → declined`, pushes user). Neither set `is_busy`, so neither clears it.

### A10. Session notes (consultant) & review (user)
- **Notes:** `GET/POST /api/connect/sessions/[id]/notes` — the **consultant's private** notes (`connect_session_notes`, RLS-scoped to the consultant on that session). **⚠ CORRECTION:** content max is **2000 chars** in the route (`content.length > 2000`), not 200 as the reference doc's session-extras line implies.
- **Review:** `POST /api/connect/sessions/[id]/review` `{ rating: 1–5 (int), review_text? ≤200 }`. Only on `status='completed'`, only **once** (`review_submitted_at` IS NULL gate). The rating average is recomputed atomically by the DB trigger **`trg_update_consultant_rating`** — the route deliberately does not recompute it in app code.

---

## User Journey B — Scheduled session (book ahead, reminders, no-show)

### B1. Schedule
1. **`POST /api/connect/sessions`** `{ type: "scheduled", consultant_id, scheduled_note, scheduled_at, scheduled_duration_min }`.
2. Guards specific to scheduled: `scheduled_note` required and **≤800 chars**; `scheduled_at` must be **≥60s in the future** (the handler does ~5 sequential DB round-trips before insert) and **≤90 days** out; `scheduled_duration_min` clamped to **5–480 min** (defaults 60).
3. **Double-booking check:** true interval overlap `[newStart,newEnd) ∩ [existingStart, existingStart+dur)` against the consultant's other `pending`/`active` scheduled sessions, looking back **8 hours** to catch a long session that started earlier (409 if conflict). `is_online` is **not** required for scheduled.
4. Still requires ≥1 min pre-paid balance and only one open session at a time. Consultant is pushed the request; user gets the confirmation email.

### B2. Reminders / the hourly cron
- There is no dedicated "reminder" cron for scheduled sessions — the reminder machinery is the **wallet** cron family (Journey C). For scheduled sessions the relevant cron is the **cleanup** one below.

### B3. No-show cleanup (the hourly cron)
- **`GET /api/cron/connect-scheduled`** runs **hourly** (`0 * * * *`). It finds `pending` + `type='scheduled'` sessions whose `scheduled_at` passed **>2 hours ago**, flips them `cancelled` (with an optimistic `.eq('status','pending')` guard), and **pushes both the user** ("Session Request Expired") **and the consultant** ("Scheduled Session Expired"). No charge — the session never went active.

### B4. Orphan cleanup vs. scheduled
- **`GET /api/cron/connect-orphans`** runs **every 10 min** (`*/10 * * * *`). It completes **active** sessions with no tick in >15 min. It **deliberately skips scheduled sessions that never ticked** — a scheduled session with `started_at` set but no ticks is legitimately waiting for its call time. Only **instant** sessions with `started_at` older than 15 min and no tick are treated as true orphans (client crashed).
- On force-close it credits the consultant for elapsed minutes (same 80/20 path), clears `is_busy`, and pushes the user "Session Ended — closed due to inactivity."

### B5. Force-close paths summary
| Path | Trigger | Effect |
|---|---|---|
| User/consultant ends | `PATCH … userEnd`/`complete` | `active→completed`, credit for `minutes_used` |
| Zero balance | `tick` path B/C | auto-complete + credit |
| Orphan (instant, no tick >15m) | `connect-orphans` cron | complete + credit elapsed, push user |
| Stale scheduled (>2h past, unaccepted) | `connect-scheduled` cron | `pending→cancelled`, no charge, push both |
| Stale recharge (>30m pending) | `connect-recharge-expiry` cron | `connect_recharges pending→failed` |

---

## User Journey C — Money back (recharge expiry, refunds, wallet dormancy/forfeit)

### C1. Recharge/order expiry rules
- Razorpay auto-expires unpaid orders after ~15 min. **`GET /api/cron/connect-recharge-expiry`** runs **every 30 min** and marks `connect_recharges` rows still `pending` for **>30 min** as `failed`. This also clears the partial-unique-index block so the user can start a fresh recharge for that companion.
- **⚠ The 30-day figure the task asks about is NOT a recharge rule** — recharges expire in **30 minutes**. The **30-day** window is the wallet **expiry notice** (§C4). The wallet balance itself expires only after **2 years** of inactivity (§C3).

### C2. Refund request (unused prepaid wallet balance)
1. User submits in-app → **`POST /api/connect/wallet/refund-request`** `{ bank_name?, account_number?, ifsc_code?, account_holder?, upi_id?, reason? }`.
2. Guards: wallet `balance > 0`; status must be `active` or `dormant`; **dormant refunds only within 1 year of `dormant_at`** (missing `dormant_at` → "contact support@imotara.com"); no existing `pending`/`processing` request; must provide **bank (account+IFSC+holder) OR a UPI id**; length caps on all fields.
3. Effect: inserts `imotara_wallet_refund_requests` (status `pending`, generated **`reference_number` `IMW-…`**), flips wallet `status='refund_requested'` (guarded to only overwrite `active`/`dormant`), and emails **the user** (confirmation, "processed within 7 business days") **and `support@imotara.com`** ("[ACTION REQUIRED] … process within 7 business days"). `GET` returns the user's last 5 requests.
4. **Who approves / where the money goes:** processed **manually** by Imotara staff via `/api/admin/connect/refunds`; funds go to the bank/UPI the user provided (not back to a card).

### C3. Wallet dormancy (the live "money-back" policy)
- **`GET /api/cron/wallet-dormant`** runs **daily 03:30 UTC** (`30 3 * * *`). For `active` wallets with `balance > 0` whose `expires_at < now` and no dormancy notice yet: sets `status='dormant'`, `dormant_at`, `notified_dormant_at`, logs an `imotara_wallet_transactions` type `dormancy_marked`, and emails a dormancy notice.
- **Balance is preserved, never zeroed**, and stays **refundable for 1 year after `dormant_at`** (code cites India's Consumer Protection Act 2019; the closed-loop wallet is PPI-exempt but honours consumer rights). `expires_at = last_activity_at + 2 years`, refreshed by any top-up/session.

### C4. Expiry notices & annual statements (the emails users get)
- **`GET /api/cron/wallet-expiry-notice`** — **daily 03:00 UTC** (`0 3 * * *`). Wallets expiring within **30 days** with no notice yet get a 30-day warning email; `expiry_notified_at` is stamped.
- **`GET /api/cron/wallet-reminders`** — **daily ~02:30 UTC** (`30 2 * * *`). Six milestone emails at **180 / 90 / 30 / 14 / 7 / 1 days** before expiry (each tracked in its own `notified_*d_at` column, 2-day window so a skipped cron day still fires) plus an **annual balance statement** once per year.

### C5. ⚠ The forfeit cron — still inconsistent
- **`GET /api/cron/wallet-forfeit`** runs **daily 04:00 UTC** (`0 4 * * *`) and **still contains code that zeros the balance** (`balance = 0, status='forfeited', forfeited_at, forfeited_amount`) and emails a "forfeited — 6-month refund window" notice.
- **Why it's practically inert but still a hazard:** it selects only `status='active'` wallets, and `wallet-dormant` runs **30 minutes earlier** (03:30 vs 04:00) converting the same expired wallets to `status='dormant'` — so by 04:00 there is normally nothing left for forfeit to catch. Additionally the v3 "ultra-safe" migration removed `forfeited` from the allowed statuses, so any row this cron *did* hit would fail the CHECK constraint.
- **Operational guidance:** treat **dormant (never-zero, 1-year refund)** as the live policy; the forfeit cron and its "6-month grace" email are superseded and should be disabled. This matches the reference doc's honesty flag #2; the added detail here is the **03:30-before-04:00 ordering** that makes dormancy win in practice.

---

## Consultant Journey — application → payout

### CJ1. Register
1. `/connect/register` → **`POST /api/connect/consultant/register`** (auth required). Every field validated in code:
   - `display_name` (required, ≤100) · `gender` (**male|female** only) · `role_category` (one of `wellness_companion, friend, dad, mom, sister, brother, grandfather, grandmother, yoga_instructor, fitness_companion`; invalid → defaults `wellness_companion`).
   - `bio` (required, ≤500) · `expertise_tags` (1–20, each ≤50) · `languages` (1–20, each ≤20) · `preferred_lang` (allow-listed, default `en`).
   - `rate_per_min` (>0, ≤10,000) · `currency_code` (**INR/USD/EUR/GBP/AED/SGD/AUD**).
   - `session_types` (filtered to `chat/audio/video`; empty → error; default `["chat"]`). **Note:** billed sessions are text chat today; audio/video are interest flags.
   - `contact_email` (valid email if present) · `contact_phone` (≤30) · `website_url` (**https://** only) · `social_links` (array; allowed keys `platform/url/handle/label`; URLs must be https; ≤4096 bytes) · `photo_url` (**https://** only).
   - `availability_note` (≤500) · `availability_windows` (array ≤28, ≤8192 bytes; shape `{ days[], months[], start "HH:MM", end "HH:MM", timezone, year }`). *(A stricter `{day,start_time,end_time}` allow-list that once silently rejected every submission was reverted to this real shape.)*
   - `verification_docs` (object; keys must be safe identifiers; **each `path` must start with `${user.id}/`** — you cannot reference another user's private upload) · `payout_info` (≤2048 bytes) · `digital_signature` (≤200).
   - **`coc_agreed` must be `true`** (Code of Conduct) or 400.
2. **Uploads:** `POST /api/connect/upload-doc` (verification docs, path-scoped to the user) and `POST /api/connect/upload-photo` (must resolve to an https URL).
3. On success: inserts `connect_consultants` `status='pending'`, upserts a `connect_wallet` row, and fires **two emails** — admin notification to **`info@imotara.com`** and an applicant "we've received your application, 1–3 business days" note. Duplicate application → 409.

### CJ2. "Pending" state
- The profile is invisible in browse (RLS + the `status='approved'` filter). The consultant cannot toggle online (`/status` returns 403 "Account not approved yet") and cannot request a payout.

### CJ3. Imotara-staff review & approval
1. Reviewer opens **`/admin → Connect`**. Queue = **`GET /api/admin/connect/pending`**; detail + signed doc URLs = `…/[id]` and `…/[id]/docs`.
2. Decision = **`PATCH /api/admin/connect/[id]/approve`** `{ action: "approve" | "reject", reason?, approval_note? }`.
3. **Authorization:** `requireSuperAdmin`, and the route **explicitly blocks `connect_reviewer` (403 "Insufficient privileges to approve consultants")** — the reviewer role is **read-only for queue/doc review**; only `owner`/`admin` may approve or reject. Idempotent (skips if already in target status). Reject requires a `reason`.
4. On approve: `status='approved'`, `approval_note` saved, a warm approval email sent (includes the personal note if provided). On reject: `status='rejected'`, `rejection_reason` saved, rejection email sent.

### CJ4. Go live — rate & availability
- **Online toggle:** `PATCH /api/connect/consultant/status` `{ is_online }` (must be `approved`).
- **Profile / rate / availability edits:** `GET/PUT /api/connect/consultant/profile`. Session list: `GET /api/connect/consultant/sessions`.

### CJ5. Taking sessions & earnings math
- Accept/complete via `PATCH /api/connect/sessions/[id]` (Journey A6–A9). Earnings accrue at completion.
- **Split: 80% consultant / 20% platform**, computed on `minutes_used × locked rate_per_min`. Verified in `creditConsultant` (`× 0.80`) and `platform_fee` (`× 0.20`) across the tick route, the PATCH-complete route, and the orphan cron.
- **`GET /api/connect/consultant/earnings`** returns `earned_amount`, `pending_payout`, `sessions_completed`, current `rate_per_min`, and the last 20 completed sessions each with `earnings = minutes_used × locked_rate × 0.80`.

### CJ6. Request a payout
1. **`POST /api/connect/consultant/payout`** `{ amount, currency_code, payout_method, payout_details }`.
2. Guards: amount > 0; **minimum ₹500 (or $10 for USD)**; `payout_method` ∈ `upi | bank | bank_in | bank_int | paypal` (normalised to `upi/bank/paypal` for the CHECK constraint, original kept in `payout_details.method_type`); details allow-listed & format-validated (UPI `name@bank`, account 8–18 digits, IFSC `XXXX0XXXXXX`, valid PayPal email); **currency must match the earnings currency** (422 otherwise).
3. Solvency: `available = earned_amount − pending_payout`; amount must be ≤ available (402 otherwise).
4. Anti-double-payout: reject if a `pending` payout exists; after insert, re-count and self-cancel (`status='failed'`) if >1 pending row races through; then **`increment_pending_payout` RPC** atomically bumps `pending_payout` (if that RPC fails the orphan payout row is cancelled). Admin is emailed.

### CJ7. Payout processing (admin side)
1. **`PATCH /api/admin/connect/payouts/[id]`** `{ status: "processing" | "completed" | "failed", admin_note? }`. `connect_reviewer` is **blocked** (403). Optimistic lock `.neq('status','completed')`.
2. On **completed** (sets `processed_at`) **or failed**, calls **`decrement_pending_payout` RPC** to release the hold.
3. **✅ RESOLVED 2026-07-18 — payout accounting hole.** `decrement_pending_payout` used to only reduce `pending_payout`, never `earned_amount` (verified in `connect_v17`/`connect_v34` SQL). Because `available = earned_amount − pending_payout`, this meant the same lifetime earnings became withdrawable again after every completed payout. Fixed via `docs/sql/connect_v38_payout_accounting.sql` — a new `finalize_completed_payout()` RPC atomically debits both fields on completion (kept `decrement_pending_payout` for failed payouts, correctly, since money never left in that case), plus a guarded one-time backfill for any historical completed payouts. Verified live: zero real payouts had actually completed before the fix shipped, so no consultant was ever double-paid — this was caught before it could cause harm, not after.

### CJ8. Suspension / blocks (consultant side)
- Admin sets `status='suspended'` via `/api/admin/connect/consultants`. Effects verified in code: `PATCH …/sessions accept` re-checks `status='approved'` (suspended → 403 "Account suspended"); payout requires `approved` (403). A suspended consultant disappears from browse (approved-only filter).

---

## Safety & moderation

- **18+**: enforced client-side (age-gate UI, `/connect/age-restricted`) **and** server-side (`connect_age_restricted` metadata → 403 on session creation). See A1.
- **Blocks — direction matters.** Only **consultant → user** blocking exists as an endpoint: `GET/POST/DELETE /api/connect/blocks` (consultant-only; `connect_blocks`, unique `consultant_id,blocked_user_id`). A blocked user cannot book that consultant (403) and is filtered out of their browse list. **⚠ There is no user→consultant block endpoint in the code** — the reference doc's "consultants can block users" is accurate; a symmetric user-side block is not implemented.
- **Emergency button — actually implemented.** The web session page (`src/app/connect/session/[id]/page.tsx`) renders an **`EmergencyModal`** (`@/components/connect/EmergencyModal`) behind an "Emergency help" button (`showEmergency` state). **⚠ CORRECTION:** the reference doc lists the emergency/crisis button as "aspirational"; it is present in the web session UI (routes to crisis resources). Confirm the mobile session screen parity separately.
- **Reporting:** there is **no dedicated `/report` endpoint** in `api/connect/**`. In-session safety today = the emergency modal + the consultant's block ability + platform bans (`user_bans` + real Supabase-level sign-in bans, made functional in v1.2.7). Treat "report a companion" as a support-email path until a report endpoint ships.
- **Code of Conduct:** enforced at registration (`coc_agreed === true` required); non-clinical positioning throughout.
- **Rate limits** curb abuse: session creation 10 / 10 min, ticks ≥55s apart, translation 60 / 60s.

---

## Quick discrepancy log (this doc vs. reference doc / code)
1. **Session notes** max length is **2000 chars** (reference implied 200).
2. **Emergency button is implemented** in the web session page (reference said aspirational).
3. **Recharge expiry = 30 minutes**, not 30 days; the 30-day figure is the wallet expiry *notice*; balance expiry is 2 years.
4. ✅ **RESOLVED** — `wallet-forfeit` removed entirely from `vercel.json` (was out-ordered by wallet-dormant anyway, and would have violated the v3 CHECK constraint).
5. ✅ **RESOLVED** — payout completion now debits `earned_amount` correctly via `finalize_completed_payout()`, verified live. Zero real consultants were ever affected before the fix.
6. **Only consultant→user blocks** exist; no user-side block endpoint.
7. Admin registration alert email goes to **`info@imotara.com`**; refund/action alerts go to **`support@imotara.com`**.
