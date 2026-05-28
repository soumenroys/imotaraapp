# Imotara — Release Go / No-Go Checklist

> Fill this out before every production release. All Non-negotiables must be YES before pushing.

---

## Release Info

| Field | Value |
|-------|-------|
| Version | |
| Build / versionCode | |
| Date | |
| Owner | |

---

## Non-negotiables (must all be YES)

### 1. Chat never blocks
- [ ] Web: can send message and receive reply
- [ ] Mobile: can send message and receive reply
- [ ] If AI fails: user sees graceful fallback (no crash, no blank screen)
- [ ] Licensing / payment failures do NOT affect chat flow

### 2. Feature gates correct
- [ ] `NEXT_PUBLIC_IMOTARA_LICENSE_MODE` is set to intended value (`off` / `log` / `enforce`)
- [ ] Free tier: daily quota enforced server-side (20 cloud replies/day)
- [ ] Plus/Pro/Enterprise: correct features unlocked per `featureGates.ts`
- [ ] No unintended paywall during active conversations

### 3. Payments are safe
- [ ] Razorpay webhook URL points to production domain (not localhost)
- [ ] `RAZORPAY_WEBHOOK_SECRET` matches Razorpay dashboard
- [ ] iOS IAP: all products are "Ready to Submit" in App Store Connect
- [ ] Android: service account key path is correct in `eas.json`

### 4. Version numbers are in sync
- [ ] Web: `package.json` version + `NEXT_PUBLIC_APP_VERSION` + `NEXT_PUBLIC_APP_BUILD` in Vercel env
- [ ] Mobile `app.json`: `version`, iOS `buildNumber`, Android `versionCode` all match
- [ ] Mobile `package.json`: `version` matches `app.json`

### 5. TypeScript clean
- [ ] `npx tsc --noEmit` passes on web (0 errors)
- [ ] `npx tsc --noEmit` passes on mobile (0 errors)

### 6. Test suite
- [ ] `node tests/full-test-suite.mjs` → 0 failures, 0 warnings

---

## Platform-specific checks

### Web
- [ ] `npm run build` passes
- [ ] `/api/health` returns `ok: true` on production
- [ ] Vercel env vars updated: `NEXT_PUBLIC_APP_VERSION`, `NEXT_PUBLIC_APP_BUILD`
- [ ] Settings → upgrade page loads correctly
- [ ] Feature comparison table renders
- [ ] Enterprise "Contact us" mailto link works

### Android
- [ ] EAS build profile: `production`, `app-bundle`
- [ ] AAB uploaded to Play Console production track
- [ ] ProGuard (`enableProguardInReleaseBuilds: true`) and resource shrinking enabled
- [ ] versionCode incremented from previous release

### iOS
- [ ] EAS build profile: `production`, store distribution
- [ ] IPA submitted to App Store Connect (build visible in TestFlight)
- [ ] All IAP products attached to the version under review
- [ ] buildNumber incremented from previous release

---

## Release Decision

- [ ] **GO** — all non-negotiables met, no blockers
- [ ] **NO-GO** — blockers listed below

Blockers / notes:
-
