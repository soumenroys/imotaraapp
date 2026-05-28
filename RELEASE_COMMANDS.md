# Imotara — Release Commands

Run these in order for each release. Both repos must be clean and committed before any push.

---

## 1. Pre-release checks

```bash
# Web
cd imotaraapp
npx tsc --noEmit                          # 0 errors
node tests/full-test-suite.mjs            # 0 failures, 0 warnings
npm run build                             # must succeed

# Mobile
cd imotara-mobile
npx tsc --noEmit                          # 0 errors
npx expo export --platform ios            # bundle resolves cleanly
```

---

## 2. Bump version (both repos)

Update all of these to the new version / build number:

| File | Fields |
|------|--------|
| `imotaraapp/package.json` | `version`, `buildNumber` |
| `imotaraapp/.env.local` | `NEXT_PUBLIC_APP_VERSION`, `NEXT_PUBLIC_APP_BUILD`, `NEXT_PUBLIC_IMOTARA_VERSION` |
| `imotara-mobile/app.json` | `version`, `ios.buildNumber`, `android.versionCode` |
| `imotara-mobile/package.json` | `version` |

Also update in Vercel dashboard: `NEXT_PUBLIC_APP_VERSION` and `NEXT_PUBLIC_APP_BUILD`.

---

## 3. Commit & push web (triggers Vercel deploy)

```bash
cd imotaraapp
git add package.json
git commit -m "chore(release): bump version to vX.X.X / build XX (web)"
git push origin main
```

---

## 4. iOS EAS build + auto-submit

```bash
cd imotara-mobile
eas build --platform ios --profile production --auto-submit --non-interactive
```

Build appears in App Store Connect → TestFlight. Then go to Distribution → create new version → add build → fill "What's New" → submit for review.

---

## 5. Android EAS build + submit

```bash
# Build
eas build --platform android --profile production --non-interactive

# Submit (use build ID from output above)
eas submit --platform android \
  --id <build-id> \
  --profile production \
  --non-interactive
```

---

## 6. Commit mobile version bump

```bash
cd imotara-mobile
git add app.json package.json
git commit -m "chore(release): bump version to vX.X.X / build XX (iOS + Android)"
git push origin main
```

---

## 7. Post-release

- [ ] Verify Vercel deploy succeeded (`/api/health` returns `ok: true`)
- [ ] iOS build visible in App Store Connect TestFlight
- [ ] Android build "In review" in Play Console production track
- [ ] Update `RELEASE_GO_NO_GO.md` with final decision and notes
