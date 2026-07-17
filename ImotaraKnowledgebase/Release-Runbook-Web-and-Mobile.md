# Imotara — Release Runbook (Web + Mobile)

Operational source-of-truth for shipping Imotara. **Web** = `imotaraapp` (Next.js on Vercel, `www.imotara.com`). **Mobile** = `imotara-mobile` (Expo/EAS, iOS + Android). Both share Supabase project `rfsbvbqtiesswnplslln`. Current release: **v1.2.7 / build 107**. Grounded in the repos' own release docs and scripts (`RELEASE_COMMANDS.md`, `RELEASE_GO_NO_GO.md`, `WEBHOOK_PROD_CHECK.md`, `scripts/bump-version.mjs`, `eas.json`) — do not improvise steps.

---

## Part A — WEB release

### A0. How a web release ships

Web deploys via **Vercel Git integration**: pushing to `main` triggers a production build automatically. There is no manual `vercel deploy` — the release *is* the `git push`. `npm run build` runs `next build`; a **prebuild** step prunes dev routes and a **postbuild** step restores them and pings the sitemap (A6).

### A1. Pre-release checks (from `RELEASE_COMMANDS.md`)

```bash
cd imotaraapp
npx tsc --noEmit                 # 0 errors
node tests/full-test-suite.mjs   # 0 failures, 0 warnings
npm run build                    # must succeed
```

### A2. Bump version

Single command (run from the web repo; edits BOTH repos, does **not** commit/tag/push, all-or-nothing):

```bash
node scripts/bump-version.mjs <version> <buildNumber>
# e.g. node scripts/bump-version.mjs 1.2.8 108
```

It rewrites: `imotaraapp/package.json` (`version`, `buildNumber`); `imotara-mobile/package.json` (`version`); `imotara-mobile/app.json` (`expo.version`, `ios.buildNumber` as quoted string, `android.versionCode` as bare int). It validates semver + integer build and aborts (writing nothing) if any pattern isn't found. It does **not** touch env files.

Then manually update what the script can't reach:
- `imotaraapp/.env.local`: `NEXT_PUBLIC_APP_VERSION`, `NEXT_PUBLIC_APP_BUILD`, `NEXT_PUBLIC_IMOTARA_VERSION`.
- **Vercel dashboard → Env Vars (Production):** `NEXT_PUBLIC_APP_VERSION`, `NEXT_PUBLIC_APP_BUILD`.

### A3. Commit & push web (this triggers the Vercel deploy)

```bash
cd imotaraapp
git add package.json
git commit -m "chore(release): bump version to vX.X.X / build XX (web)"
git push origin main
```

### A4. Web go/no-go checklist (`imotaraapp/RELEASE_GO_NO_GO.md`)

All non-negotiables must be **YES**:
1. **Chat never blocks** — send/receive works; AI failure shows graceful fallback (no crash/blank); licensing/payment failures don't affect chat.
2. **Feature gates** — `NEXT_PUBLIC_IMOTARA_LICENSE_MODE` set to intended value (`off` / `log` / `enforce`); Free daily quota enforced server-side (20 cloud replies/day); tiers unlock correctly per `featureGates.ts`; no paywall mid-conversation.
3. **Payments safe** — Razorpay webhook URL is the production domain; `RAZORPAY_WEBHOOK_SECRET` matches the dashboard; iOS IAP products "Ready to Submit"; Android service-account key path correct in `eas.json`.
4. **Version sync** — web `package.json` + `NEXT_PUBLIC_APP_VERSION`/`BUILD`; mobile `app.json` version/buildNumber/versionCode; mobile `package.json` matches `app.json`.
5. **TypeScript clean** — `tsc --noEmit` = 0 on both repos.
6. **Test suite** — `node tests/full-test-suite.mjs` → 0 failures/0 warnings.
Plus: `npm run build` passes; `/api/health` returns `ok:true` on prod; Vercel env vars updated; upgrade page works.

### A5. Webhook production check (`WEBHOOK_PROD_CHECK.md`)

Goal: donation receipts appear because Razorpay webhooks hit the deployed backend.
1. Razorpay Dashboard → Webhooks: URL **must** be `https://<PROD-DOMAIN>/api/payments/razorpay/webhook` — never localhost/preview.
2. Webhook Secret must match Vercel Production `RAZORPAY_WEBHOOK_SECRET`; also confirm `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`.
3. Subscribe at least `payment.captured` and `order.paid`.
4. Open `https://<PROD-DOMAIN>/api/health` → confirm `ok:true`, Razorpay+Supabase env flags `true`. If `ok:false`, STOP and fix env first.
5. "Send Test Webhook" → expect HTTP 200, Vercel logs "✅ Razorpay webhook verified", a row upserted in `donations`, a receipt visible in Settings → Recent donations. If "Delivered" but no receipt: check signature verification in logs → secret → URL is prod → Supabase reachable → `donations` unique constraint (`provider + razorpay_payment_id`).

### A6. Build-time automation (automatic)

- **`scripts/ping-sitemap.mjs`** (postbuild): pings Google/Bing with `https://www.imotara.com/sitemap.xml`; only fires when `VERCEL=1` (or `PING_SITEMAP=1`); non-fatal.
- **`scripts/devRoutes.mjs`** (prebuild `prune` / postbuild `restore`): removes `src/app/dev` and `src/app/license-debug` from production builds so they never ship. Active when `IMOTARA_PRUNE_DEV_ROUTES=1` or (`NODE_ENV=production` && `CI=true`).
- `next.config.ts` enforces security headers/CSP in-repo (Razorpay checkout allowed, Supabase REST+WSS allowed, `frame-ancestors 'none'`, HSTS preload).

### A7. Manual SQL migration process (`docs/sql/`, Supabase SQL Editor) — and its risks

Database migrations are **applied by hand** in Supabase Dashboard → SQL Editor, using the service-role connection. There is no automated migration runner. `docs/sql/` holds the versioned `.sql` files; `docs/sql/org_migration_README.md` documents strict run order, per-step verification queries, and reverse-order rollback DROPs.

Per migration:
1. Supabase → SQL Editor → New query.
2. Paste one `.sql` file's contents → Run. **Run files in the documented order** (e.g. org: `org_schema` → `org_audit_log` → `org_licenses_alter` → `org_functions`; Connect migrations are strictly sequential `connect_v2 … v37`).
3. Run the verification query for that step before proceeding.

For v1.2.7, three migrations were applied this way: `api_key_rate_limit.sql`, `fix_pool_release_on_member_removal.sql`, `org_owner_race_lockdown.sql`.

**Risks:** entirely manual and out-of-band from the code deploy — nothing enforces that DB schema matches the deployed app. Wrong run order breaks dependencies; it's easy to forget a file or run against the wrong project. Rollback is manual reverse-order `DROP ... CASCADE` (destructive). **Apply migrations before the web deploy that depends on them** (Part D).

### A8. Web rollback

Vercel: **Instant Rollback / promote a previous deployment** (each `main` push is an immutable deployment). Env-var changes are separate — reverting a deploy does not revert env changes. Applied DB migrations must be rolled back manually (often not safely reversible if data changed).

---

## Part B — MOBILE release (EAS)

### B1. Version triple-sync

Before building: `package.json` version, `app.json` `expo.version`, `ios.buildNumber` (string) and `android.versionCode` (int) must all agree — buildNumber and versionCode being the **same integer**. `eas.json` sets `cli.appVersionSource: "local"`, so the values in `app.json` are authoritative. Verify:

```bash
cd imotara-mobile
npm run check:version   # scripts/check-version-sync.js (from the safety-net branch)
npx tsc --noEmit        # must be 0 errors
```

### B2. EAS build profiles (`eas.json`) and their env differences

Both profiles are `distribution: "store"`, base URL `https://www.imotara.com`, same Supabase + Google client IDs. Key differences:

| Setting | `iosTestflight` | `production` |
|---|---|---|
| Platforms | iOS only | iOS + Android (`android.buildType: app-bundle`) |
| `EXPO_PUBLIC_LAUNCH_CLOUD_SYNC_FREE_FOR_ALL` | `true` | `false` |
| `EXPO_PUBLIC_RAZORPAY_KEY_ID` | `rzp_test_...` (test) | `rzp_live_...` (**live**) |

> ⚠️ Two traps: (a) `production` uses the **live** Razorpay key — never ship a store build on the test key. (b) The launch flag: `eas.json` sets `EXPO_PUBLIC_LAUNCH_CLOUD_SYNC_FREE_FOR_ALL`, but the mobile code actually derives its free-cloud-sync override from `EXPO_PUBLIC_IMOTARA_LAUNCH_DATE`/`EXPO_PUBLIC_IMOTARA_FREE_DAYS` (defaults to free-for-all when unset). Confirm the *intended* behavior in-app, not just the eas.json value.

### B3. iOS build + auto-submit

```bash
cd imotara-mobile
eas build --platform ios --profile production --auto-submit --non-interactive
```

Submit config (`eas.json`): `appleId roysoumen@icloud.com`, `ascAppId 6756697569`, `appleTeamId MY64TKZ69W`. Build lands in App Store Connect → TestFlight. Then in ASC: create the version → add build → "What's New" → submit for review. All IAP products must be attached to the version and "Ready to Submit".

### B4. Android build + submit

```bash
eas build --platform android --profile production --non-interactive
eas submit --platform android --id <build-id> --profile production --non-interactive
```

Submit config: `serviceAccountKeyPath: /Users/soumenroy/Documents/Imotara/Administrative Docs/imotara-651b778a7dbb.json`, `track: production`. Confirm the new `versionCode` appears in the Play Console production track.

### B5. R8 mapping upload & ProGuard

- `app.json` `expo-build-properties`: `enableProguardInReleaseBuilds: true`, `enableShrinkResources: true` (both required by go/no-go). iOS deployment target 16.0.
- **Config plugin `./plugins/withAndroidR8Mapping`** embeds the R8/ProGuard `mapping.txt` into the AAB (`BUNDLE-METADATA/com.android.tools.build.obfuscation/proguard.map`) during `bundleRelease` so Play Console auto-extracts it for crash symbolication.
- Manual upload fallback: `scripts/upload-android-mapping.js <mapping.txt> <versionCode>` (same service-account JSON, Android Publisher API). Extract from an AAB with `unzip -p release.aab BUNDLE-METADATA/com.android.tools.build.obfuscation/proguard.map > mapping.txt`.

### B6. Commit mobile version bump

```bash
cd imotara-mobile
git add app.json package.json
git commit -m "chore(release): bump version to vX.X.X / build XX (iOS + Android)"
git push origin main
```

### B7. OTA updates (`expo-updates`, `runtimeVersion.policy: "appVersion"`)

`app.json`: `updates.url: https://u.expo.dev/d035812a-...`, `runtimeVersion: { policy: "appVersion" }`. **What "appVersion" means:** an OTA update is only delivered to installed builds whose **`expo.version` matches** the update's runtime version. So:
- **OTA works** for JS-only changes shipped under the **same** `version` — publish with `eas update`; installed 1.2.7 builds pick it up without a store submission.
- **A new store build is required** whenever you bump `version`, change native code/config, add native modules, or change `app.json`'s native surface.
Practical rule: within a `1.2.7` line you can OTA-patch JS; going to `1.2.8` needs new store builds.

### B8. Mobile go/no-go checklist (`imotara-mobile/RELEASE_GO_NO_GO.md`)

Fill Version / buildNumber / versionCode / Date / Owner, then all non-negotiables **YES**:

1. **Chat never blocks** — cloud path works; if API fails, local reply engine activates gracefully; payment/licensing failures do **not** affect chat.
2. **Version sync** — `app.json` version + `ios.buildNumber` + `android.versionCode` incremented; `package.json` matches.
3. **Feature gates correct** — launch flag set to intended value; mobile `featureGates.ts` tier sets match web (run the test suite); no unintended paywall mid-conversation.
4. **Payments safe** — Razorpay `fetchWithTimeout` wired + double-tap protected; iOS IAP product IDs "Ready to Submit"; correct Android service-account key in `eas.json`.
5. **TypeScript clean** — `npx tsc --noEmit` = 0.
6. **Bundle asset formats** — avatar images are **JPEG** (not PNG); sounds are **MP3** (not WAV); ProGuard + shrinkResources on.

### B9. Mobile rollback options / limits

- **OTA republish** — if a bad JS-only change went out via `eas update`, publish/republish a known-good update to the same runtime version. Only helps for OTA-delivered JS.
- **Store rollback limits** — you **cannot** roll a native store build backwards to a lower versionCode/buildNumber. Recovery is forward-only: bump the build number and ship a fixed build (Apple review latency applies). On Google Play you can halt/reduce a staged rollout, but not publish a lower versionCode. Prefer OTA for hotfixes when the runtime version still matches.

---

## Part C — Post-release verification

- [ ] Vercel deploy succeeded — `/api/health` returns `ok: true`.
- [ ] iOS build visible in App Store Connect TestFlight.
- [ ] Android build "In review" in Play Console production track.
- [ ] Update `RELEASE_GO_NO_GO.md` with the final decision and notes.

---

## Part D — Combined release-day order of operations

Each gate blocks the next:

1. **DB migrations first** — apply any new `docs/sql/*.sql` by hand in the Supabase SQL Editor, in documented order, verifying each step (A7). Schema must be ready *before* dependent code deploys.
2. **Pre-release gates** — web `tsc` + `full-test-suite.mjs` + `npm run build`; mobile `tsc` + `check:version` (A1/B1).
3. **Bump versions** — `node scripts/bump-version.mjs <version> <build>`, then `.env.local` + Vercel env vars (A2).
4. **Deploy web** — commit + push `imotaraapp` to `main`; Vercel auto-builds and deploys (A3).
5. **Verify web infra** — `/api/health` `ok:true`; Razorpay webhook prod check; confirm crons are live (`vercel.json`: `/api/push/cron` daily 09:00, `/api/cron/exchange-rates` 02:00, `connect-orphans` every 10m, `connect-scheduled` hourly, `connect-recharge-expiry` every 30m, plus 4 wallet crons) (A5, C).
6. **Mobile builds** — iOS `eas build --profile production --auto-submit`; Android `eas build` + `eas submit` (B3/B4). Verify R8 mapping embedded (B5).
7. **Stores** — ASC version submit (attach IAP products); confirm Android versionCode in Play production track; commit the mobile bump and push (B6).
8. **Post-release** — run Part C, update both `RELEASE_GO_NO_GO.md` files.

For a **JS-only mobile hotfix** within the same `version`, skip steps 6–7 and instead `eas update` to the matching runtime version (B7).
