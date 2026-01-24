# Imotara — Razorpay Webhook (Production) Verification

Goal: Ensure donation receipts appear in Settings because Razorpay webhooks are hitting the DEPLOYED backend.

---

## 1) Confirm the webhook URL (Razorpay Dashboard)

In Razorpay Dashboard → Webhooks:

Webhook URL MUST be:

https://<YOUR-PROD-DOMAIN>/api/payments/razorpay/webhook

Examples:
- https://imotara.com/api/payments/razorpay/webhook
- https://imotaraapp.vercel.app/api/payments/razorpay/webhook

✅ Must be your PRODUCTION domain (not localhost, not preview URL).

---

## 2) Confirm webhook secret matches Vercel env

Razorpay Dashboard webhook has a "Secret".

That secret MUST match your deployed env var:

RAZORPAY_WEBHOOK_SECRET

Also confirm:
RAZORPAY_KEY_ID
RAZORPAY_KEY_SECRET

✅ These must be set in Vercel Project → Settings → Environment Variables (Production).

---

## 3) Confirm subscribed events

Enable at least these events:
- payment.captured
- order.paid

(Your server logs donations on these.)

---

## 4) Quick production sanity (before sending test webhook)

1. Open:
   https://<YOUR-PROD-DOMAIN>/api/health

2. Confirm:
   - `ok: true`
   - Razorpay + Supabase env flags are `true`
   - No secrets are visible

3. If `ok: false`, STOP and fix env vars before proceeding.

---

## 5) Use “Send Test Webhook”

Razorpay Dashboard → Webhook → "Send Test Webhook"

Expected:
- Razorpay says delivered (HTTP 200)
- Your Vercel logs show: "✅ Razorpay webhook verified"
- A receipt row is inserted/upserted in `donations`
- Settings → Recent donations shows it (may take a few seconds)

---

## 5) If Razorpay says “Delivered” but no receipt appears

Check in this order:
1) Vercel logs show signature verified?
2) Is RAZORPAY_WEBHOOK_SECRET correct in Production env?
3) Is the webhook URL pointing to Production domain?
4) Is Supabase reachable from Production env?
5) Is the donations table unique constraint present (provider + razorpay_payment_id)?

---

## 6) If receipt appears locally but not in Production

99% causes:
- Webhook URL is pointing to localhost/preview
- Production env vars missing or wrong
- Wrong webhook secret in dashboard vs env

---

## Done criteria

✅ A test webhook produces a visible receipt in Production Settings page.
