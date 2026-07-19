# Playbook — Payments & Purchases

*Step-by-step, code-verified purchase journeys across every payment rail Imotara ships: Razorpay (web + Android fallback), Google Play IAP, Apple IAP, Stripe, token packs, corporate/org, and donations — plus a support DIAGNOSTIC section. Grounded in `src/app/api/license/**`, `src/app/api/payments/**`, `src/lib/imotara/grantLicense.ts`, `src/app/api/subscription/cancel`, `src/lib/donations/logDonation.ts`, and the mobile `UpgradeSheet.tsx` / `payments/*`. Endpoint + table names are given for every step. This complements the Connect wallet flows in "Playbook — Imotara Connect Journeys."*

## Product catalog (single source of truth: `grantLicense.ts` `PRODUCT_CATALOG`)
| productId | type | tier / tokens | INR | paise | days |
|---|---|---|---|---|---|
| `plus_monthly` | subscription | plus | ₹99 | 9,900 | 31 |
| `plus_annual` | subscription | plus | ₹699 | 69,900 | 366 |
| `pro_monthly` | subscription | pro | ₹149 | 14,900 | 31 |
| `pro_annual` | subscription | pro | ₹1,299 | 129,900 | 366 |
| `tokens_100` | token_pack | 100 | ₹49 | 4,900 | — |
| `tokens_250` | token_pack | 250 | ₹99 | 9,900 | — |
| `tokens_600` | token_pack | 600 | ₹199 | 19,900 | — |
| `tokens_1800` | token_pack | 1800 | ₹499 | 49,900 | — |

**`grantLicense(userId, productId, admin, source)` semantics:**
- **Subscription:** stacks expiry (`baseMs = max(now, existing expiry)` + `days`), **never downgrades tier** (TIER_RANK: free 0 · plus 1 · pro 2 · family 3 · edu 4 · enterprise 5 — a Pro user who buys Plus keeps Pro with stacked expiry; fixed 2026-07-19, `grantLicense.ts` used to tie family/edu at 3 and short enterprise to 4, diverging from the canonical ranking in `serverGate.ts`). Writes `licenses` row `status='valid'`, `source`.
- **Token pack:** `token_balance += tokens`; tier/expiry untouched.
- **Idempotency** lives one layer up in each rail via the **`payment_licenses`** table keyed by `payment_id` (Razorpay pay id / Apple transactionId / Google purchaseToken).

---

## Buy a plan on WEB (Razorpay)
1. User picks a plan/token pack on `/upgrade` (or `/pricing`).
2. Client → **`POST /api/license/order-intent`** `{ productId }` (auth: cookie or Bearer). Returns `{ razorpay: { orderId, keyId, amount, currency } }`; the Razorpay order carries **`notes: { purpose: "imotara_license", productId, userId }`**.
3. Client opens the **Razorpay checkout** with `orderId`/`keyId`.
4. On success → **`POST /api/license/verify-payment`** `{ paymentId, productId }`.
   - **Behind the scenes:** validates `paymentId` matches `^pay_[A-Za-z0-9]+$` → **polls Razorpay** `GET /v1/payments/{id}` up to 5×2s for `captured` (accepts `authorized` for UPI-mandate pre-capture and grants anyway, trusting the webhook) → **idempotency check on `payment_licenses`** (already processed → returns current `licenses` row) → **upsert `payment_licenses`** (records payment before granting to block double-grant) → **`grantLicense(…, "razorpay")`** writes `licenses` → **`createInvoice`** writes `payment_invoices`.
5. Redirect back to `/settings` (or the caller refreshes `GET /api/license/status`).
6. **Failure paths:** payment `failed/refunded/expired` → 400 `Payment not completed`; verify unreachable → the **webhook backstop** still grants (below); missing Razorpay keys → 503.

**Webhook backstop — `POST /api/payments/razorpay/webhook`** (events `payment.captured` / `order.paid`): verifies **HMAC-SHA256 of the raw body** against `RAZORPAY_WEBHOOK_SECRET` (timing-safe) → reads `notes.purpose`. For `imotara_license`: idempotency check on `payment_licenses`, `grantLicense`, upsert `payment_licenses`, `createInvoice`. It also routes `imotara_corporate` (org creation), Connect recharges, wallet top-ups, and unrecognised captures → donations (see below).

---

## Buy on ANDROID (two paths)
Driven by `UpgradeSheet.tsx` using **expo-iap**. Sign-in is prompted first (`promptSignIn`) so the purchase links to the account and can be restored.

### Path 1 — Google Play Billing (default, recommended)
1. `handleAndroidPurchase(productId)` → `requestPurchase({ type: "subs" | "in-app", request: { android: { skus: [productId] } } })`. Android SKUs == server productIds (no bundle prefix).
2. `onPurchaseSuccess` fires → reads `purchaseToken` → **`POST /api/payments/google-play/verify`** `{ productId, purchaseToken }` (Bearer token).
   - **Behind the scenes:** idempotency on `payment_licenses` (by `purchaseToken`) → **`verifyGooglePlaySubscription`/`verifyGooglePlayProduct`** against Google → **`acknowledgeGooglePlayPurchase`** (required within 3 days or Google auto-refunds) → insert `payment_licenses` (`tier='pending'`) → `grantLicense(…, "google_play")` → update `payment_licenses.tier` → `createInvoice` (`payment_invoices`, gateway `google_play`).
3. Client calls `finishTransaction`. On network failure after pay, `pollLicenseStatus` polls `/api/license/status` for ~21s; else "tap Restore purchases."

### Path 2 — Razorpay fallback (if Play Billing unavailable)
1. `doAndroidPurchase` → **`POST /api/license/order-intent`** → **RazorpayCheckout.open** (`react-native-razorpay`) → **`POST /api/license/verify-payment`** `{ paymentId, productId }` (45s timeout to cover verify's internal Razorpay polling).
2. Same server flow as WEB Razorpay above. On non-ok verify, `pollLicenseStatus` gives the webhook ~20s to grant.

**Android "Restore previous plan":** signs in → **`GET /api/license/status`** and reflects whatever tier the server already holds (no store round-trip — Google purchases were already server-verified).

---

## Buy on IOS (Apple IAP + Restore)
1. `handleIosPurchase(sku, type)` → `requestPurchase({ type, request: { apple: { sku } } })`. iOS SKUs are bundle-prefixed `com.imotara.imotara.<productId>`.
2. `onPurchaseSuccess` → **`POST /api/license/verify-apple-purchase`** `{ productId, transactionId }` (Bearer, 35s timeout).
   - **Behind the scenes:** idempotency on `payment_licenses` (by `transactionId`) — and if a prior grant left `licenses.tier='free'` despite a paid `payment_licenses.tier`, it **re-runs `grantLicense`** to honour the purchase → **fail-closed if Apple creds missing (503)** — never grants unverified → **Apple App Store Server API** verify (mints ES256 JWT, tries **production then sandbox**, verifies the **JWS `x5c` leaf-cert ES256 signature** in IEEE-P1363 form, 3× retry for indexing race) → **productId match** (strips bundle prefix) → insert `payment_licenses` → `grantLicense(…, "apple")` → `createInvoice` (gateway `apple`).
3. Client calls `finishTransaction`.
4. **Restore Purchases** (App Store guideline requirement, iOS button): `getAvailablePurchases({ onlyIncludeActiveItemsIOS: true })` → for each active **subscription** (token packs skipped) re-POST `/api/license/verify-apple-purchase` to re-grant on this account.
5. **Fail-closed behaviour is the headline:** with no `APPLE_IAP_ISSUER_ID/KEY_ID/PRIVATE_KEY`, the route returns 503 and grants nothing — matching the Google route's stance. A bad signature or product mismatch → 400.

---

## Stripe checkout (international / where Razorpay isn't configured)
**Who uses it:** individual subscribers/token buyers whose product has a configured Stripe price ID (`getStripePriceId`), and **corporate** buyers on the web pricing page. If no price ID → 503 telling the user to use Razorpay.
1. Client → **`POST /api/payments/stripe/checkout`**.
   - **Individual:** `{ productId }` → `stripe.checkout.sessions.create` with `mode: subscription|payment`, the pre-configured `price`, `metadata: { imotara_user_id, imotara_product_id }`. Returns a hosted `url`. Success → `/settings?stripe_success=1`.
   - **Corporate:** `{ orgType, seats }` → price computed **server-side** from `$49/seat/yr` (`CORPORATE_BASE_USD_CENTS_PER_SEAT=4900`) with discounts `ngo 60% / edu 50% / commercial,govt 0%` (client-sent amount is never trusted). `mode: payment`, `metadata.purchase_type='corporate'`.
2. **Webhook — `POST /api/payments/stripe/webhook`** (verifies `stripe-signature` against `STRIPE_WEBHOOK_SECRET`; **missing secret → 500 so Stripe retries** and monitoring flags it):
   - `payment_intent.succeeded` → token pack/corporate. Corporate: create `organizations` (status `pending`), `releasePriorOrgMembership`, `org_members` owner, `licenses` org row, email `info@imotara.com` to activate, `createInvoice`. Token pack: `grantLicense(…, "stripe")` + invoice.
   - `invoice.payment_succeeded` → subscription grant; stores `subscription.id` in `licenses.external_ref` (used by cancel); invoice.
   - `customer.subscription.deleted` → revert to `free` (only rows with `source='stripe'`).

---

## Token packs — what they are & how they're consumed
- **What:** consumable "message credits" (`tokens_100/250/600/1800`). Buying increments `licenses.token_balance` only (tier/expiry untouched).
- **The quota they back:** in **`POST /api/respond`** (and the mirrored `/api/chat-reply` LIC-2 gate), **Free or expired** users are limited to **20 enhanced replies per UTC day**, counted from `usage_events` (`count(*) where created_at >= todayStart`).
- **Consumption rule:** when a free user hits **≥20** for the day, the server checks `token_balance`; if **> 0** it **decrements `token_balance` by 1** (`update … token_balance = balance-1 … .gt('token_balance',0)`) and serves the reply; if **0** it returns `{ meta: { from: "quota_exceeded", reason: "daily_limit", limit: 20 } }`. So one token = one extra enhanced reply beyond the daily 20. Paid tiers (`plus`/`pro`, unexpired) bypass the gate entirely. Fail-open: DB errors never block a reply.

---

## Corporate / org purchase (Razorpay path)
1. Web `/pricing/corporate` → **`POST /api/payments/razorpay/corporate`** `{ orgType, seats }`. Valid `orgType`: `commercial | ngo | edu | govt`; valid `seats`: **10 | 50 | 100 | 500**.
2. **Per-seat/year INR** (paise): commercial/govt **₹1,999** (199,900), ngo **₹799** (79,900), edu **₹999** (99,900). Tier: edu→`edu`, ≥100 seats→`enterprise`, else `plus`. Razorpay order carries `notes: { purpose: "imotara_corporate", orgType, seats, tier, userId, userEmail }`.
3. Razorpay checkout → **webhook `payment.captured`** with `purpose='imotara_corporate'` creates the org **`pending`** (`organizations`, slug `rzp-…`, `seats_purchased`), calls `releasePriorOrgMembership(userId, orgId)` (a user holds only one paid seat), inserts `org_members` owner, upserts `licenses` org row. Admin then **activates** at `/admin → Organizations`. (Stripe corporate path is the parallel option above, priced in USD.)

---

## Donations end-to-end
1. Settings → Donate → **`POST /api/payments/donation-intent`** `{ presetId, purpose?, platform? }`. Requires **`IMOTARA_DONATION_ENABLED=true`** (else 403). Presets (paise, both web `inr_*` and mobile `d-*` ids accepted): **₹49/99/199/499/999**. Returns a Razorpay order (Stripe-shaped for mobile compat) with `notes.purpose='imotara_donation'`.
2. Razorpay checkout → **webhook** `payment.captured`/`order.paid`. Because donation orders have **no `productId`/recharge/topup match**, they fall through to **`logDonation`** which upserts **`donations`** (idempotent on `provider,razorpay_payment_id`) and inserts a **`billing_events`** audit row.
3. **Receipt in Settings:** `settings/page.tsx` reads **`GET /api/donations/recent`** to show the user their donation receipts.

---

## Cancel subscription (per platform)
**`POST /api/subscription/cancel`** (auth: cookie/Bearer). Reads `licenses` (`source`, `external_ref`, `expires_at`):
- **Stripe:** `stripe.subscriptions.update(external_ref, { cancel_at_period_end: true })`.
- **Razorpay:** `POST /v1/subscriptions/{external_ref}/cancel { cancel_at_cycle_end: 1 }`.
- **Apple / Google:** the server **cannot** cancel on the user's behalf — direct them to **iOS Settings → Subscriptions** / **Google Play → Subscriptions** (the mobile `UpgradeSheet` footer says exactly this).
- In all cases the license is marked **`status='cancelling'`** and **access is kept until `expires_at`**, then a webhook (`customer.subscription.deleted` for Stripe) reverts to `free`.

---

## DIAGNOSTIC — support runbook

### "I paid but have no license" — per rail
Check these three tables first (all keyed to the user / payment):
- **`payment_invoices`** — was an invoice written? (means grant fired). Look up by `user_id` + gateway ref.
- **`payment_licenses`** — the idempotency ledger; `payment_id` = Razorpay `pay_…`, Apple `transactionId`, or Google `purchaseToken`. A row here with `licenses` still `free` means **grant failed after payment was recorded**.
- **`licenses`** — the effective entitlement (`tier`, `token_balance`, `expires_at`, `status`, `source`, `external_ref`).

| Rail | If stuck, do this |
|---|---|
| **Web / Android-Razorpay** | Re-call **`POST /api/license/verify-payment`** `{ paymentId, productId }` (idempotent — re-grants). Confirm the **Razorpay webhook** delivered `payment.captured`; the webhook re-grants using `notes`. Check `RAZORPAY_WEBHOOK_SECRET` is set. |
| **Android Google Play** | Re-call **`POST /api/payments/google-play/verify`** `{ productId, purchaseToken }`. Verify the purchase was **acknowledged** (unacknowledged >3 days → Google auto-refunds). Have the user tap **Restore previous plan** (`/api/license/status`). |
| **iOS Apple** | Re-call **`POST /api/license/verify-apple-purchase`** `{ productId, transactionId }` (auto-recovers a prior failed grant). If it 503s, **Apple IAP env vars are missing** (`APPLE_IAP_ISSUER_ID/KEY_ID/PRIVATE_KEY`) — fix config; it fails closed by design. Have the user tap **Restore previous purchases**. |
| **Stripe** | Check the **webhook** (`invoice.payment_succeeded` / `payment_intent.succeeded`); a 500 means `STRIPE_WEBHOOK_SECRET` missing (Stripe will retry). Corporate orgs land in `organizations` `status='pending'` — activate at `/admin → Organizations`. |
| **Connect recharge / wallet top-up** | See the Connect Journeys playbook §Diagnostics — check `connect_recharges` / `imotara_wallet_orders` by `razorpay_order_id`; the Razorpay webhook auto-completes browser-crash cases. |

### "I was double-charged"
- The **`payment_licenses`** upsert (`onConflict: payment_id, ignoreDuplicates`) prevents a **double grant** for the same payment id, but does **not** prevent two distinct Razorpay/Store charges. Identify the two distinct `payment_id`s (Razorpay dashboard / App Store / Play Console). Grants stack on subscriptions (extra time) or add tokens; one of the two payments must be **refunded on the rail that charged it** (below). Note token-pack grants and subscription stacking are both idempotent per payment id, so a genuine double-charge = two payment ids.

### "How do I refund" — per rail
- **Razorpay (plan/token/recharge):** refund on the **Razorpay dashboard**. For Connect recharges, the `refund.processed` webhook flips the `connect_recharges` row to `refunded`. Session minutes already consumed are non-refundable (a real person was paid).
- **Stripe:** refund the PaymentIntent/invoice in the **Stripe dashboard**; `customer.subscription.deleted` (on cancel) reverts tier to free.
- **Apple:** users must request via **Apple's report-a-problem** flow — Imotara cannot refund IAP directly.
- **Google:** refund in **Play Console** (or the user via Google Play); unacknowledged purchases auto-refund after 3 days.
- **Wallet balance (prepaid):** the in-app **`POST /api/connect/wallet/refund-request`** (bank/UPI, `IMW-…` ref, ~7 business days, manual) — see the Connect Journeys playbook §C2.

### Env vars that silently break rails (missing from `.env.example`)
`STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET / STRIPE_PRICE_*`; `APPLE_IAP_ISSUER_ID / KEY_ID / PRIVATE_KEY`; `GOOGLE_PLAY_*`; `RAZORPAY_WEBHOOK_SECRET`; `IMOTARA_DONATION_ENABLED`. A missing Stripe/Apple secret fails **closed** (503/500); a missing Razorpay webhook secret makes the verify-endpoint the only grant path (webhook backstop silently no-ops).
