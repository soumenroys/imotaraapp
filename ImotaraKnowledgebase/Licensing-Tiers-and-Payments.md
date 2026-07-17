# Imotara — Licensing, Tiers & Payments

*Source-of-truth reference for the Imotara web platform (`imotaraapp`, Next.js 16 + Supabase). Covers consumer license tiers, how feature gating actually works today, effective-tier resolution for organisation members, every payment rail, manual license grants, cancellation/invoicing, and the most common support answers. Grounded in the code as of v1.2.7 (build 107).*

> **Read this first — the soft-launch reality.** Imotara is in a soft-launch state. The licensing *matrix* is fully designed but almost nothing is enforced in the UI yet. The single hard server-side rule that is always active is the **20 cloud replies/day quota for Free users** in `/api/chat-reply`. Everything else (Plus/Pro/Family/EDU/Enterprise feature gates) is defined in code but gated behind `NEXT_PUBLIC_IMOTARA_LICENSE_MODE`, which ships as `off`. Where a capability is aspirational or de-scoped, this doc says so.

---

## 1. Consumer tiers

Six consumer tiers exist in the type system (`src/types/license.ts`, `src/lib/imotara/license.ts`):

```
free | plus | pro | family | edu | enterprise
```

Note the naming: the web/canonical codebase uses **lowercase** tier names (`free`, `plus`, `pro`…). Older mobile/architecture artifacts sometimes reference `PREMIUM`/`FAMILY` in uppercase — these are legacy labels for the same concept (`pro` ≈ "premium"). The tier-rank ordering (used everywhere a higher-vs-lower decision is made) is defined in SQL `tier_rank()`:

```
free(0) < plus(1) < pro(2) < family(3) < edu(4) < enterprise(5)
```

### Pricing model

Pricing is documented in `docs/LICENSING.md` and encoded in the product catalog (`src/lib/imotara/grantLicense.ts`). The catalog is the authoritative source for what is actually chargeable through the payment rails:

| Product ID (catalog key) | Type | Tier | Duration | Price (INR paise) | Price (₹) |
|---|---|---|---|---|---|
| `plus_monthly` | subscription | plus | 31 days | 9,900 | ₹99 |
| `plus_annual` | subscription | plus | 366 days | 69,900 | ₹699 |
| `pro_monthly` | subscription | pro | 31 days | 14,900 | ₹149 |
| `pro_annual` | subscription | pro | 366 days | 129,900 | ₹1,299 |
| `tokens_100` | token pack | — | — | 4,900 | ₹49 (100 tokens) |
| `tokens_250` | token pack | — | — | 9,900 | ₹99 (250 tokens) |
| `tokens_600` | token pack | — | — | 19,900 | ₹199 (600 tokens) |
| `tokens_1800` | token pack | — | — | 49,900 | ₹499 (1,800 tokens) |

- **Family / EDU / Enterprise are not sold self-serve** through this catalog. They are provisioned as **organisations** (see §4 and the org-licensing flow) — priced per seat, per year, with NGO/EDU discounts. Corporate per-seat pricing lives in the corporate order routes: `commercial`/`govt` ₹1,999/seat/yr, `ngo` ₹799/seat/yr (60% off), `edu` ₹999/seat/yr (50% off) — Razorpay (`/api/payments/razorpay/corporate`); the Stripe equivalent is USD $49/seat/yr base with the same discount table.
- **Token packs never expire** and only top up `licenses.token_balance`; they never change tier or expiry (see grant logic in §5).

### Feature matrix (design intent)

This is the *designed* per-tier feature set from `docs/LICENSING.md`. **Important:** with `LICENSE_MODE=off`, none of these gates are enforced in the web UI today — every signed-in user effectively has full access during the launch offer window. Treat this as the roadmap for what gets switched on when `LICENSE_MODE=enforce`.

| Capability | Free | Plus | Pro | Family | EDU | Enterprise |
|---|:--:|:--:|:--:|:--:|:--:|:--:|
| Daily cloud AI replies | **20/day (enforced)** | Unlimited | Unlimited | Unlimited | Unlimited | Unlimited |
| Offline AI fallback | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Cloud history retention | 7 days | 90 days | Unlimited | Unlimited | Unlimited | Unlimited |
| Cloud sync | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Data export (JSON/CSV/PDF) | ❌ | ✅ | ✅ | ❌* | ❌* | ✅ |
| Advanced TTS (voice/rate/pitch, Azure Neural) | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Semantic/exact search mode | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Reply cadence controls | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Emotion trends / insights | ❌ | ❌ | ✅ | ✅ | ✅ (aggregated) | ✅ |
| Companion letter (monthly) | ❌ | ❌ | ✅ | ✅ | ❌ | ✅ |
| Growth-arc narrative | ❌ | ❌ | ✅ | ✅ | ❌ | ✅ |
| Multi-profile | ❌ | ❌ | ❌ | ✅ (up to 6) | ✅ | ✅ |
| Child-safe mode | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| Parental controls / family dashboard | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| Admin dashboard | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Classroom/cohort, LMS | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| API access, SSO/SAML, data residency, custom integrations | ❌ | ❌ | ❌ | ❌ | partial (SSO/residency) | ✅ |
| Imotara Connect (human companions) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

\* Family export is intentionally disabled (shared-device privacy boundary). EDU individual export is intentionally disabled; only aggregated/anonymised admin export exists. Both are deliberate product decisions, not gaps.

The **code-level** feature set (what `gate()` in `src/lib/imotara/featureGates.ts` will grant when enforcement is on) matches this matrix. Each tier is a `Set<FeatureKey>`; the history-days limit is a parameterised gate returning `{ days: 7 | 90 | Infinity }`.

---

## 2. How feature gating works (technical)

### 2.1 The three moving parts

1. **`NEXT_PUBLIC_IMOTARA_LICENSE_MODE`** — `off | log | enforce` (`src/lib/imotara/license.ts::getLicenseMode`). Ships as `off`. This is the master switch. In `off`/`log`, tier-based reply constraints and UI gates are not applied; in `enforce`, they activate.
2. **The launch offer** — `NEXT_PUBLIC_IMOTARA_LAUNCH_DATE` + `NEXT_PUBLIC_IMOTARA_FREE_DAYS` (default 120 in `.env.example`, code default 90). Between the launch date and launch+FREE_DAYS, `getCurrentLicenseStatus()` returns a **`pro` trial for everyone**. This is why all users currently see full features regardless of what they paid.
3. **`featureGates.gate(feature, tier)`** — the central resolver. Always call this rather than scattering `tier === "pro"` checks. Returns `{ enabled: true, params? }` or `{ enabled: false, reason }`.

### 2.2 What is actually enforced right now

Exactly one thing: the **Free-tier daily cloud-reply quota** in `src/app/api/chat-reply/route.ts`. It is deliberately independent of `LICENSE_MODE` — it always runs. The logic:

- On each chat reply, the route reads the caller's `licenses` row and counts today's rows in `usage_events` (UTC day boundary).
- A user is "free" if they have no license row or `tier === 'free'`, **and** no active trial (`expires_at` in the future).
- If free, no active trial, and today's `usage_events` count **≥ 20**:
  - If they hold token-pack credits (`token_balance > 0`), one token is decremented and the reply proceeds.
  - Otherwise the route returns `{ text: "", meta: { from: "quota_exceeded", reason: "daily_limit", used, limit: 20 } }` (HTTP 200, no reply).
- Every allowed reply fires a fire-and-forget `usage_events` insert (`event_type: 'chat_reply'`, plus anonymised emotion label for org analytics).

Security note: the quota decision is only applied when the bearer token's identity is **signature-verified** (`authedUserId === provisionalUserId`). A forged token that merely *claims* a victim's `sub` never passes verification, so it can't burn a victim's quota or credits.

> Practical implication for support: the "20/day" limit in `docs/LICENSING.md` sometimes reads as "10/day" in the marketing matrix. **The code enforces 20.** The 10/day figure is stale copy.

### 2.3 Phase-3 reply constraints (only in enforce mode)

When `LICENSE_MODE === "enforce"` and the user is authenticated, the chat route can inject a tier-based response-length constraint into the system prompt (e.g. keep Free replies to 2–3 sentences). In `off`/`log` this never runs — soft launch is preserved.

### 2.4 Enforcement roadmap (from the licensing doc)

| Phase | Action |
|---|---|
| Now (soft launch) | All features open; only the 20/day Free quota is hard-enforced |
| Phase 2 | `LICENSE_MODE=enforce`; Plus/Pro UI gates activate |
| Phase 3 | Mobile gates activate; `LAUNCH_CLOUD_SYNC_FREE_FOR_ALL=false` |
| Phase 4 | EDU/Enterprise gate enforcement via admin-assigned org tier |

---

## 3. Effective-tier resolution (personal vs org)

For any signed-in user, the *effective* tier is not simply their `licenses.tier`. It is resolved by the `resolve_user_tier(user_id)` Postgres RPC (SECURITY DEFINER), wrapped by `resolveUserTier()` in `src/lib/imotara/org.ts` and called by `/api/license/status`.

**Priority chain (highest wins)** — final version in `docs/sql/org_license_pools.sql`:

1. **Pool assignment** (`org_license_assignments`) → source `pool_assignment`
2. **Per-member override** (`org_members.override_tier`) → source `org_override`
3. **Org default tier** (if higher than the personal tier) → source `org`
4. **Personal license** (if non-free) → source `personal`
5. **Free** → source `default`

Additional rules baked in:
- Org context only counts if the org is `active`, the membership is `active`, and the org isn't expired.
- `/api/license/status` applies a **belt-and-braces expiry check** client-side: if `expires_at` is in the past, it forces tier→`free`, status→`expired`. Fail-open: if the DB call errors, it returns the fallback (launch-offer/free) status rather than blocking the user.
- The status response also surfaces org context (`orgId`, `orgName`, `orgRole`, `billingType`) so the client can hide personal-upgrade prompts from org members.

`GET /api/license/status` accepts either a Bearer token (mobile) or Supabase cookie (web) and returns `{ ok, mode, license: { status, tier, source, expiresAt, tokenBalance }, org, user }`.

---

## 4. Payment rails — step by step

Imotara supports four consumer rails plus a corporate seat-purchase path. All grants funnel through one helper: **`grantLicense(userId, productId, adminClient, source)`** in `src/lib/imotara/grantLicense.ts`. Its guarantees:

- **Subscriptions extend expiry** (stack on an active subscription, reset if expired) and **never downgrade tier** — a Pro user who buys Plus keeps Pro with stacked expiry.
- **Token packs** only increment `token_balance`; tier and expiry untouched.
- Idempotency is enforced upstream via the `payment_licenses` table (one row per gateway payment/transaction ID).

### 4.1 Razorpay (INR) — subscriptions & token packs

The web/mobile client calls two endpoints:

1. **`POST /api/license/order-intent`** `{ productId }` — auth via Bearer or cookie. Validates the product against `PRODUCT_CATALOG`, creates a Razorpay order (Basic-auth `key:secret`, amount in paise, `notes` carry `purpose: imotara_license`, `productId`, `userId`), and returns `{ razorpay: { orderId, keyId, amount, currency } }`. Requires `RAZORPAY_KEY_ID`/`RAZORPAY_KEY_SECRET` (returns 503 if unset).
2. Client opens Razorpay checkout with that order; user pays.
3. **`POST /api/license/verify-payment`** `{ paymentId, productId? }` — the user-initiated confirm. It:
   - Rejects `paymentId` not matching `^pay_[A-Za-z0-9]+$` (SSRF guard on the Razorpay URL).
   - **Polls Razorpay up to 5×/10s** for `captured`; accepts `authorized` (UPI mandate pre-capture) and grants anyway, trusting the webhook to confirm.
   - Idempotency: if `payment_licenses` already has this `paymentId`, returns the current license unchanged.
   - Records the payment first (`payment_licenses` upsert, `ignoreDuplicates`), then calls `grantLicense(..., "razorpay")`, then creates an invoice (non-blocking).

**Webhook — `POST /api/payments/razorpay/webhook`** (`x-razorpay-signature`, HMAC-SHA256 of the *raw* body, timing-safe). This is the server-trust path and the safety net if the browser dies mid-flow. On `payment.captured`/`order.paid` it branches on the order's `notes`:
- `purpose: imotara_corporate` → creates a **pending** organisation + owner membership (see §4.5).
- `purpose: imotara_license` → idempotent `grantLicense` + invoice.
- No purpose note → checks in order: is it a **Connect recharge** (marks `connect_recharges` completed), a **wallet top-up** (`imotara_wallet_orders` → `credit_imotara_wallet` RPC), else logs it as a **donation**.
- Also handles `payment.failed` (recharge→failed) and `refund.processed` (recharge→refunded).

### 4.2 Stripe (international) — subscriptions, token packs, corporate

- **`POST /api/payments/stripe/checkout`** — two modes:
  - *Individual*: uses pre-configured Stripe **price IDs** looked up by env var `STRIPE_PRICE_{PRODUCTID}` (e.g. `STRIPE_PRICE_PLUS_MONTHLY`) via `getStripePriceId()`. Returns 503 if that price isn't configured (directs user to Razorpay). Subscription products use `mode: subscription`; token packs use `mode: payment`.
  - *Corporate*: dynamic `price_data` from a **server-side** price table ($49/seat/yr × seats × (1−discount); NGO 60%, EDU 50%). The client's displayed amount is never trusted for the charge.
  - Metadata carries `imotara_user_id` and `imotara_product_id` (or corporate fields).
- **Webhook — `POST /api/payments/stripe/webhook`** (`getStripe().webhooks.constructEvent`, needs `STRIPE_WEBHOOK_SECRET` — returns **500** if unset so Stripe retries and monitoring catches it):
  - `payment_intent.succeeded` → token pack / corporate org grant + invoice.
  - `invoice.payment_succeeded` → subscription grant; stores `subscription.id` in `licenses.external_ref` (needed by the cancel route).
  - `customer.subscription.deleted` → reverts tier to `free` (only rows with `source = 'stripe'`).

Stripe env vars (from `src/lib/stripeClient.ts`, **not** all present in `.env.example` — a known gap): `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, plus one `STRIPE_PRICE_*` per subscription/token product.

### 4.3 Apple IAP (iOS) — `POST /api/license/verify-apple-purchase`

Bearer auth. Body `{ productId, transactionId }`. Flow:
- Idempotency via `payment_licenses` keyed on `transactionId`; includes a **self-heal** — if a prior grant failed after the payment row was written (tier still `free`), it re-runs `grantLicense`.
- **Fails closed** if `APPLE_IAP_ISSUER_ID`/`APPLE_IAP_KEY_ID`/`APPLE_IAP_PRIVATE_KEY` are missing (503 — never grants unverified).
- Builds an ES256 App Store Server API JWT, calls production then sandbox (covers TestFlight), retries 3× on 404 (StoreKit indexing race).
- **Verifies Apple's JWS signature** using the x5c leaf certificate (IEEE P1363 encoding), then confirms Apple's `productId` (after stripping the `com.imotara.imotara.` bundle prefix) matches the claimed catalog key.
- Records payment, grants `..., "apple"`, writes invoice.

### 4.4 Google Play (Android) — `POST /api/payments/google-play/verify`

Bearer auth. Body `{ productId, purchaseToken, orderId? }`. Flow:
- Idempotency via `payment_licenses` keyed on `purchaseToken`.
- Verifies with the Play Developer API (`verifyGooglePlaySubscription` / `verifyGooglePlayProduct`) using `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`; **acknowledges** the purchase (required within 3 days or Google auto-refunds).
- Inserts an idempotency row (`tier: 'pending'`) **before** granting, then `grantLicense(..., "google_play")`, updates the row's tier, writes invoice. `PACKAGE_NAME` defaults to `com.imotara.imotara`.

### 4.5 Corporate seat purchase (creates an org)

Both Razorpay (`/api/payments/razorpay/corporate`) and Stripe (corporate mode) create a Razorpay/Stripe order/session with `purpose: imotara_corporate` metadata. On webhook success, the platform **auto-creates an organisation in `status: pending`** with the buyer as `owner`, seats from the order, and a tier mapped from org type (`edu`→`edu`, otherwise `enterprise`). A Imotara admin then activates it from `/admin → Organizations`. Critically, both webhooks call `releasePriorOrgMembership(userId, newOrgId)` first — the v1.2.7 fix that stops a user from occupying paid seats in two orgs at once (the most severe seat-leak path, since a user can trigger it by self-paying with zero admin involvement).

---

## 5. Granting / seeding a license manually

### 5.1 Auto-seed on sign-in — `POST /api/license/seed`

Called fire-and-forget by mobile after sign-in (Bearer auth, always returns 200). Runs `seedLicenseIfAbsent()` which upserts a `free`/`trial` license row with `expires_at = now + FREE_DAYS` and `notes: 'launch-offer'`, using `ON CONFLICT DO NOTHING` so it's a safe no-op if a row already exists.

### 5.2 Admin grant — `POST /api/admin/licenses`

Protected by admin auth (super-admin session cookie or legacy `ADMIN_SECRET` Bearer). Body: `{ userId, userEmail, tier, status, expiresAt?, tokenBalance?, notes?, adminLabel? }`. Upserts the `licenses` row with `source: 'manual'` and writes an `admin_license_history` audit row (action derived: assign / tier_change / extend / token_adjust / withdraw / status_change). `GET` on the same route searches users via the `admin_search_users_with_licenses` RPC. Per-user detail/edit is at `/api/admin/licenses/[userId]`; history at `/api/admin/licenses/history`.

This is the correct tool for "grant someone Pro for 3 months" or "add token credits" without a payment.

---

## 6. Cancellation & invoices

### 6.1 Cancel — `POST /api/subscription/cancel`

Auth via Bearer or cookie. Reads the user's license; refuses if tier is `free`. Then:
- **Stripe** (`source = stripe`, `external_ref` set): `subscriptions.update(..., { cancel_at_period_end: true })`.
- **Razorpay** (`source = razorpay`, `external_ref` set): Razorpay subscription cancel with `cancel_at_cycle_end: 1`.
- **Apple / Google**: cannot cancel on the user's behalf — the response directs them to the store (see §7).
- Marks `licenses.status = 'cancelling'` but **keeps access until `expires_at`**, then it reverts to Free. Returns a friendly message with the end date.

### 6.2 Invoices

- **`GET /api/invoice`** — lists the caller's invoices from `payment_invoices` (last 50).
- **`GET /api/invoice/[invoiceId]`** — renders an **HTML** invoice. Access control: the paying user, or an `owner`/`admin` of the org on the invoice. `?download=1` sets a `Content-Disposition` attachment header. Invoices are created (non-blocking) by every grant path via `createInvoice()`.

---

## 7. Common support answers

**"I paid but didn't get my license."**
1. The webhook is the safety net — a browser crash after payment is recovered by the Razorpay/Stripe webhook, which re-grants idempotently. First, wait ~1–2 minutes.
2. For Razorpay UPI, the payment may sit `authorized` briefly before `captured`; verify-payment grants on `authorized` and the webhook confirms.
3. Check `payment_licenses` for their gateway payment/transaction ID. If the row exists but `licenses.tier` is still `free`, a grant failed after recording — re-running verify (Apple route self-heals; others are idempotent) or an **admin manual grant** (`/api/admin/licenses`) fixes it.
4. If `STRIPE_WEBHOOK_SECRET` or Apple/Google credentials are unset in the environment, verification fails closed (503) and no license is granted — an ops/config issue, not a user one.

**"How do I cancel?"** Web/mobile in-app cancel hits `/api/subscription/cancel`. Stripe/Razorpay are cancelled at period end automatically — access continues until `expires_at`. **Apple and Google subscriptions must be cancelled in the App Store / Play Store** — Imotara cannot cancel those on the user's behalf (the cancel response says so).

**"How do I restore my purchase on a new phone?"** Purchases are tied to the Supabase account, not the device. Signing in re-runs `/api/license/seed` and `/api/license/status`, which resolves the existing license. For store subscriptions, the platform's restore-purchases flow re-submits the transaction to the Apple/Google verify route, which is idempotent and returns the current license.

**"Why does my friend on Free see all the premium features?"** Because `LICENSE_MODE=off` and the launch offer grants everyone a `pro` trial. This is expected during soft launch. The only Free limit that actually bites is 20 cloud replies/day.

**"I hit my daily limit."** Free users get 20 cloud AI replies/UTC-day. Options: wait for reset, buy a token pack (₹49–₹499; tokens never expire and are consumed one-per-reply past the daily cap), or upgrade to Plus/Pro. Offline replies are unlimited.
