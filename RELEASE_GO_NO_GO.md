# Imotara — RELEASE GO / NO-GO Checklist (Public v1)

Date:
Build/Commit:
Owner:

## Non-negotiables (must be YES)

### 1) Chat never blocks (web + mobile)
- [ ] Web: can send message and receive reply
- [ ] Mobile: can send message and receive reply
- [ ] If AI fails: user sees graceful fallback (no crash, no blank screen)
- [ ] Donation / licensing failures do NOT affect chat flow

### 2) Licensing is passive (3 months free)
- [ ] App works when licensing endpoints are down
- [ ] Default behavior is FREE (no gating)
- [ ] No paywall UI / no countdown / no restriction messaging

### 3) Donations are ethical + safe
- [ ] Donation buttons are ONLY in Settings / About (not in chat)
- [ ] Copy is neutral (no guilt / no pressure)
- [ ] Donation never changes chat behavior or tone
- [ ] Web: donation-intent works (presetId only)
- [ ] Mobile: donation-intent works (presetId only)
- [ ] Webhook logs receipts (idempotent; no duplicates)
- [ ] Web + Mobile: receipt confirmation can lag without confusing users

### 4) Web ↔ Mobile parity (behavior)
- [ ] Both platforms produce the same response structure (main reply + optional reflection seed)
- [ ] Follow-ups are natural (no “follow-up question:” label)

---

## GO / NO-GO Tests (run now)

### Web (imotaraapp)
- [ ] `npm run dev` works locally
- [ ] `npm run build` passes
- [ ] `npm run donation:check` returns `{ ok: true, razorpay: ... }`
- [ ] PROD: `/api/health` returns `ok: true` (no secrets leaked)
- [ ] Settings → Donation: checkout opens
- [ ] Close checkout: shows “Checkout closed. No payment was made.”
- [ ] Payment failure: shows “Payment failed …” (no crash)
- [ ] Payment success: shows “Checkout completed… Confirming receipt…”
- [ ] Receipts list updates (immediate or after short delay)

### Mobile (imotara-mobile)
- [ ] App launches and chat works
- [ ] Settings → Donation: checkout opens
- [ ] Success message says “Checkout completed … confirming receipt …”
- [ ] No duplicate order from double taps
- [ ] Chat unaffected if donation fails/cancelled

---

## Release Decision

### GO criteria (must all be true)
- [ ] All Non-negotiables are YES
- [ ] No crashes in primary paths (chat + settings)
- [ ] Donations are optional and non-blocking
- [ ] Passive licensing confirmed

Decision:
- [ ] GO
- [ ] NO-GO

Notes / blockers:
-
