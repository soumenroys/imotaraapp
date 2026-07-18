# Imotara — Mobile App Technical Guide

Imotara Mobile is the Expo / React Native client for Imotara. This build is **v1.2.7 (build 107)**. Mobile and web share one backend (`www.imotara.com` + Supabase project `rfsbvbqtiesswnplslln`). Repo: `github.com/soumenroys/imotara-mobile`. This guide is grounded in the actual source.

## 1. Stack summary

- **Expo SDK 54** (`expo@54.0.35`), **React Native 0.81.5**, **React 19.1.0**.
- **New Architecture enabled** (`app.json` → `newArchEnabled: true`) — runs on Hermes, which is why the codebase avoids `AbortSignal.timeout()` (see §12, `fetchWithTimeout`).
- **TypeScript strict** — `tsc --noEmit` is a release gate (`npm run typecheck`).
- Navigation: `@react-navigation/native` v7 + `@react-navigation/bottom-tabs` v7.
- Auth/data: `@supabase/supabase-js` v2, `@react-native-async-storage/async-storage` 2.2.0, `expo-secure-store`.
- Audio/voice: `expo-speech`, `expo-av`, `expo-file-system`.
- Payments: `expo-iap` (Apple/Google), `react-native-razorpay`.
- Build tooling: `expo-build-properties`, custom config plugin `./plugins/withAndroidR8Mapping`, `expo-updates` for OTA.
- Bundle IDs: iOS `com.imotara.imotara` (Apple Team `MY64TKZ69W`, ASC app `6756697569`), Android `com.imotara.imotara`.
- iOS deployment target 16.0; Android `enableProguardInReleaseBuilds` + `enableShrinkResources` on.

### Entry / provider structure (order-dependent)

`index.ts` → `registerRootComponent(App)`. `App.tsx` composes providers in a **specific, load-bearing order**:

```
ErrorBoundary
  └─ AppShell            (evaluates IMOTARA_API_BASE_URL early; shows a config-error screen in prod if missing)
       └─ AppThemeProvider
            └─ ThemeProvider
                 └─ AuthProvider           ← must wrap Settings
                      └─ SettingsProvider  ← must wrap History (HistoryProvider calls useSettings())
                           └─ HistoryProvider
                                └─ RootNavigator + StatusBar
```

**Settings MUST wrap History** because `HistoryProvider` calls `useSettings()`, and Auth wraps Settings because Settings reacts to `onAuthStateChange`. `ErrorBoundary` renders a "Something went wrong / Restart app / Send crash report" screen (builds a `mailto:info@imotara.com` crash report with app version, platform, stack). `App.tsx` deliberately does **not** install a root-level `KeyboardAvoidingView` — each screen handles its own keyboard avoidance (a root wrapper double-applied the shrink and overlapped the tab bar on short screens).

## 2. The 5 tabs / screens (`src/navigation/RootNavigator.tsx`)

A `createBottomTabNavigator` with `backBehavior="history"` and Ionicons:

1. **Chat** (`src/screens/ChatScreen.tsx`, ~5,800 lines, header hidden) — the core companion chat. Sends messages to the cloud AI (`/api/chat-reply` first, then `/api/respond`), with a local reply engine fallback so **chat never blocks**. Includes haptics, crisis-tier detection (`detectMobileCrisisTier`), TTS speaker buttons, swipeable quick panels, voice input.
2. **History** (`src/screens/HistoryScreen.tsx`) — paged (`PAGE_SIZE=50`) conversation history with multilingual emotion keyword detection, session grouping (`SESSION_GAP_MS` = 45 min), search, export/share, pull-to-refresh cloud sync.
3. **Trends** (`src/screens/TrendsScreen.tsx`) — local-history emotion analytics (streak, weekly emotion-frequency bars, dominant emotion per day), quick mood check-in, Companion Letter card, Year-in-Review. Carries a **tab badge** polled every 10s from `getBadgeCount()` (`src/lib/pendingInsights.ts`).
4. **Connect** (`src/screens/connect/ConnectScreen.tsx`, ~5,600 lines, header hidden) — human-consultant marketplace: consultant search/favorites, wallet top-ups & recharges (Razorpay), live sessions with per-minute ticking, translation, reviews. All sub-views are local state (no nested stack navigator).
5. **Settings** (`src/screens/SettingsScreen.tsx`, ~5,200 lines) — profile/companion tone, plan & upgrade (UpgradeSheet / IOSTipJar / Razorpay presets), sync controls, notifications, data export, "Managed by" org badge, settings search.

A global **SyncStatusStrip** overlays the top of the app ("Syncing…", "Synced ✓", "Sync failed — will retry"), driven by `HistoryContext`. Onboarding is a one-time modal gated on AsyncStorage key `imotara.onboarding.done.v1`.

**Deep linking** — scheme `imotara://` maps `imotara://chat|history|trends|settings|connect` to the tabs. The same scheme is central to the OAuth relay (§3).

## 3. Auth (`src/auth/AuthContext.tsx`, `src/lib/supabase/client.ts`)

Supabase client persists the session in **SecureStore** (Keychain/Keystore) via `ExpoSecureStoreAdapter` — `autoRefreshToken: true`, `persistSession: true`, `detectSessionInUrl: false` (required in RN). On start it restores the persisted session, then subscribes to `onAuthStateChange`.

**Google OAuth relay flow:** `signInWithOAuth({ provider: "google", redirectTo: "https://imotara.com/auth/callback-mobile", skipBrowserRedirect: true })`. The relay page reads tokens from the URL hash and fires `imotara://auth/callback#<tokens>`.
- **iOS:** `WebBrowser.openAuthSessionAsync(url, "imotara://")` — ASWebAuthenticationSession intercepts the `imotara://` redirect synchronously; tokens are parsed and `supabase.auth.setSession(...)` is called, returning `{success:true}`.
- **Android:** Chrome Custom Tabs cannot intercept custom schemes mid-flow. The relay fires a system intent that foregrounds the app; a `Linking` handler catches `auth/callback`, extracts tokens and calls `setSession` **asynchronously**. `signInWithGoogle` then polls `getSession()` for up to 5s (700ms interval) to still return `{success:true}` when it arrives quickly. Callers must handle success arriving async after `{success:false}`.
- **Session-fixation guard:** `expectingAuthCallbackUntil` (a 2-minute window armed right before opening the browser) — any `imotara://auth/callback` deep link arriving outside that window is rejected, preventing an attacker-crafted callback link from silently signing the victim into the attacker's account.

**Apple Sign-In:** native `AppleAuthentication.signInAsync` (FULL_NAME + EMAIL scopes) → `supabase.auth.signInWithIdToken({ provider: "apple", token })`. Guarded require so dev builds without the native module don't crash. `ERR_CANCELED` is treated as a non-error.

**Anonymous identity:** whenever there is no real session (fresh install, sign-out, expired anon session), `supabase.auth.signInAnonymously()` establishes a real-but-anonymous Supabase session so guest features work without signup.

### The critical `accessToken` vs `anonymousAccessToken` separation rule

The single most important auth invariant:
- **`accessToken`** = the JWT of a *real, signed-in, accountable, recoverable-across-reinstall* account. Dozens of call sites treat `accessToken` truthy as "this is a real account" — Connect wallet/payouts/sessions, "sign in to restore your plan", license seeding, profile sync, IAP verification.
- **`anonymousAccessToken`** = a real Supabase JWT for a signed-out guest's anonymous identity. **Use it ONLY for narrowly-scoped guest features: chat TTS, voice-input transcription, settings search.** Merging the two would silently let anonymous identities into money-moving flows they were never designed for.

On a real sign-in, the app seeds a free license row via `POST /api/license/seed`. Involuntary session loss (ban/suspend → refresh fails) fires the same `SIGNED_OUT` event as a voluntary sign-out; `explicitSignOutInFlight` + `wasAuthenticatedRef` distinguish them so the user sees a clear "You've been signed out… contact support" alert instead of being silently downgraded to anonymous (a v1.2.7 fix). `signOut()` clears `imotara.companion.memories.v1`, `imotara_settings_v1`, `imotara_license_tier_v1`.

## 4. Org / license context on mobile (`src/state/SettingsContext.tsx`, `src/licensing/featureGates.ts`)

`SettingsContext` owns license + org state. **`refreshLicense()` runs on every auth event** (SIGNED_IN, INITIAL_SESSION, TOKEN_REFRESHED) plus at startup — it calls `GET /api/license/status` (the authoritative `resolveUserTier()` source honoring the `pool_assignment > org_override > org_tier > personal > free` priority chain). It maps the server tier to the mobile enum:

```
pro → PREMIUM · plus → PLUS · family → FAMILY · edu → EDU · enterprise → ENTERPRISE · else FREE
```

and persists `imotara_license_tier_v1` + `imotara_license_expires_at_v1`, recomputing `cloudSyncAllowed`. It also auto-populates `chatLinkKey` with the user's auth ID (first 80 chars) on first sign-in so cross-device history pull works without manual setup. Running `refreshLicense` on **every** auth event (not just launch) is a v1.2.7 fix — otherwise a mid-session org change left a stale "Managed by" badge until restart.

**Org context:** `orgId / orgName / orgRole / orgBillingType` come from the `/api/license/status` `org` block, cached in `imotara_org_context_v1`. The **"Managed by" badge** uses `orgBillingTypeMeta()` (`src/lib/imotara/orgBilling.ts`): `ngo → 🤝 NGO`, `edu → 🎓 Education`, `govt → 🏛️ Government`, `commercial → 🏢`. Upgrade prompts are hidden from org-managed members.

**Feature gates** (`src/licensing/featureGates.ts`): tiers `FREE | PLUS | PREMIUM | FAMILY | EDU | ENTERPRISE`; feature keys include `CLOUD_SYNC`, `HISTORY_UNLIMITED`, `HISTORY_DAYS_LIMIT` (FREE=7d, PLUS=90d, else unlimited), `TRENDS_INSIGHTS`, `EXPORT_DATA`, `MULTI_PROFILE`, `CHILD_SAFE_MODE`, `ADMIN_DASHBOARD`, `TTS_ADVANCED`, `SEARCH_MODE`, `REPLY_CADENCE`, `COMPANION_LETTER`, `GROWTH_ARC`. Central resolver is `gate(feature, tier)` — always use it, never scattered `tier === ...` checks. This mirrors the web `featureGates.ts`; RELEASE_GO_NO_GO requires parity (verified by `src/__tests__/featureGates.test.ts`).

**`SOFT_LAUNCH_BYPASS_ALL_GATES` flag (currently `true`):** mirrors web's `license_mode="off"` — every user gets the individual **PREMIUM ("Pro")** consumer experience for free by evaluating gates as if the tier were PREMIUM. Crucially, the **institutional** entitlements `MULTI_PROFILE`, `CHILD_SAFE_MODE`, `ADMIN_DASHBOARD` (in `INSTITUTIONAL_FEATURES`) are exempt from the bypass — they stay gated to real Family/EDU/Enterprise membership, so the bypass never *revokes* them from real institutional users. The user's *real* tier is untouched (Settings' "Current plan" still shows the truth); only feature *checks* are bypassed. Flip to `false` once tiers are actually sold.

## 5. TTS on mobile (`src/lib/tts/mobileTTS.ts`)

**Native-first strategy with Azure Neural fallback.** For a given language it checks `Speech.getAvailableVoicesAsync()` (cached); if a native voice exists it uses `expo-speech` (free, offline). English is always available natively.

- **Chunked, pipelined fetching:** `splitIntoSpeechChunks(text, firstMax=110, restMax=240)` splits on sentence terminators across scripts (Latin `.!?`, Devanagari `।`, Urdu `۔`, Arabic `؟`, CJK `。！？`). The **first** chunk is capped small so speech starts as soon as the first sentence synthesizes. `speakMessage` **pipelines**: it fetches chunk N+1 while chunk N plays. Audio is fetched from `POST {apiBase}/api/tts` and written to alternating cache files so a prefetched next chunk never clobbers a playing file.
- **Per-chunk 20s timeout:** `CHUNK_FETCH_TIMEOUT_MS = 20_000` is armed fresh before *each individual chunk fetch* — it is **not** a ceiling on the whole reply (a long reply legitimately takes longer).
- **Generation counter / cancellation:** `_generation` is bumped on `stopAll()`/`stopSpeaking()`; chunk loops check it to bail. `_resolveCurrentChunk` lets a stop unstick an in-flight playback await. AbortError from a user stop does **not** trigger the native fallback.
- **Script/language detection for voice:** `detectMessageLang(text, fallbackLang)` detects the reply's actual dominant script (the AI replies in the script the user typed, independent of the stale `preferredLang` setting). Devanagari ties broken by `MARATHI_HINT` (substring matching, not `\b` — JS `\w` is ASCII-only so `\b` never fires around Devanagari), Arabic ties by `URDU_HINT`.
- **Gender / novelty voice quirks (Samsung):** `pickNativeVoice` matches requested gender via name patterns **and** Samsung's identifier encoding (`SMTf`/`SMTm`), because Samsung encodes gender in the voice ID, not the name. `NOVELTY_VOICE_PAT` filters out OEM novelty voices (albert, bells, bubbles, zarvox, …) — the novelty filter always wins. When no voice is confidently gendered, the preview shifts pitch (male 0.78 / female 1.18) so Male vs Female stay audibly distinct; if the device has no installed voice for the language, `onUnavailable` fires a toast (Samsung engines can otherwise go silently silent).
- **Preview MP3s:** `speakPreview` uses static pre-generated Azure MP3s at `{apiBase}/tts-preview/{lang}-{male|female}.mp3`. English + a custom companion name is the one case needing dynamic Azure synthesis (auth-gated).

`TTS_ADVANCED` (Plus+) gates Azure Neural — Free tier forces the on-device voice. TTS/voice-input use `anonymousAccessToken` (guest-allowed).

## 6. Sync engine (`src/state/HistoryContext.tsx`)

Local-first with best-effort cloud sync. History is stored in AsyncStorage under **scoped keys** so identities never see each other's data:
- `scopedKey(base, chatLinkKey, localUserScopeId)` → `${base}:${chatLinkKey}` when a cross-device **`chatLinkKey`** exists, else `${base}:local:${localUserScopeId}` (device-local), with a legacy fallback for migration. Bases: `imotara_history_v1`, `imotara_history_remote_since_v1`, `imotara_threads_v1`.

`runSync()` (deduped, throttled 900ms, hydration-guarded) does: (1) push local unsynced → `pushRemoteHistory`; (2) incremental remote pull via `fetchRemoteHistorySince(since)` with an in-memory cursor and a **scope guard** (discard results if `chatLinkKey` changed in-flight); (3) pull remote chat messages (skipped when `analysisMode === "local"`); (4) final dedupe/sort. Merges use `mergeSorted` (O(n+m)) and fingerprint dedup (`from : first-80-chars : 1-min bucket`). FREE-tier history pruning (`HISTORY_DAYS_LIMIT`) **never deletes unsynced items**. Background auto-sync is scheduled `autoSyncDelaySeconds` (clamped 3–60s, default 8) after unsynced changes; foreground resume sync is triggered by `useAppLifecycle`.

**Launch free-cloud-sync override** — `LAUNCH_CLOUD_SYNC_FREE_FOR_ALL`: computed from `EXPO_PUBLIC_IMOTARA_LAUNCH_DATE` (+ `EXPO_PUBLIC_IMOTARA_FREE_DAYS`, default 90). If no launch date is set, it defaults to **`true`** (soft-launch free-for-all, matching web `LICENSE_MODE=off`). When true, cloud push/pull is allowed even for gated tiers. (See §12 — the env var this reads differs from the one named in eas.json.)

## 7. Notifications (`src/notifications/checkInReminder.ts`)

Uses `expo-notifications` via a lazy `require` (so Expo Go/Simulator builds without the native module don't crash).
- **Daily check-in reminder** — `scheduleCheckInReminder(hour=20, minute=0, ...)` with a DAILY trigger; stored under `imotara.checkin.*` keys.
- **Inactivity nudge** — one-shot after `inactivityHours` (default 48). Localized "we miss you" copy in ~22 languages (generic + personalized variants referencing the user's last topic).
- **Connect push tokens** — `ConnectScreen` registers the device's Expo push token with the server (`POST /api/connect/user/push-token`) so consultants/users get accept/decline/force-close notifications.

## 8. Payments on mobile

Two rails:
- **`expo-iap`** (StoreKit 2 on iOS, Google Play Billing on Android) — `src/components/imotara/UpgradeSheet.tsx`. Product catalog in `src/payments/upgradePlans.ts`: subscriptions `plus_monthly/plus_annual/pro_monthly/pro_annual`, consumable token packs `tokens_100/250/600/1800`. iOS SKUs are bundle-prefixed (`com.imotara.imotara.plus_monthly`); Android SKUs equal the server `PRODUCT_CATALOG` keys exactly. Verify endpoints: iOS `POST /api/license/verify-apple-purchase` (also used by Restore Purchases), Android `POST /api/payments/google-play/verify`. Post-purchase it polls `GET /api/license/status`.
- **Razorpay** (`react-native-razorpay`) — Android upgrade fallback and all **Connect wallet** flows: `create` → `RazorpayCheckout.open` → `verify` (`/api/connect/wallet/topup/create|verify`, `/recharge/create|verify`, `/api/license/order-intent` + `/api/license/verify-payment`). Payment fetches use a 30s timeout; double-tap is guarded with a ref. `RAZORPAY_MAX_INR = 500000` domestic ceiling. Donations in `src/payments/donations.ts`.

## 9. Config / env (`src/config/api.ts`, `src/config/debug.ts`, `src/config/flags.ts`)

`EXPO_PUBLIC_*` variables (Expo inlines these at build). API base URL resolution priority: (1) `EXPO_PUBLIC_IMOTARA_API_BASE_URL`, (2) legacy `IMOTARA_API_BASE_URL`, (3) **dev-only** fallback (Metro host inference, `localhost`→`10.0.2.2` on Android emulator). In production with no env it **fails fast** and `AppShell` shows an "App Configuration Error" screen. Both build profiles point the base at `https://www.imotara.com`.

Other env: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`, `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`, `EXPO_PUBLIC_RAZORPAY_KEY_ID` (test vs live per profile), `EXPO_PUBLIC_IMOTARA_DEBUG_UI`, `EXPO_PUBLIC_IMOTARA_LAUNCH_DATE` / `EXPO_PUBLIC_IMOTARA_FREE_DAYS`. `src/config/flags.ts` hardcodes `SHOW_DEBUG_TOOLS = false`. Note `mobileTTS.ts` hardcodes a fallback base of `https://imotaraapp.vercel.app` if the env var is absent.

## 10. Storage keys inventory

**AsyncStorage:** `imotara.onboarding.done.v1`, `imotara_history_v1:<scope>`, `imotara_history_remote_since_v1:<scope>`, `imotara_threads_v1:<scope>`, `imotara_license_tier_v1`, `imotara_license_expires_at_v1`, `imotara_settings_v1` (tone context, chatLinkKey, localUserScopeId, analysisMode, sync prefs…), `imotara_org_context_v1`, `imotara.companion.memories.v1` (cleared on sign-out), `imotara.checkin.*` (notification prefs), haptic intensity.

**SecureStore (Keychain/Keystore):** the Supabase session/JWT via `ExpoSecureStoreAdapter`.

### Play Data Safety summary (`PLAY_DATA_SAFETY.md`)

Collects: in-app chat messages (required; sent only to the developer's own server for AI response + optional sync), voice recordings (optional, temporary, transcription only), emotional/mood health info (optional), name/age-range/gender (optional, AI personalization), anonymous user ID (required), payment info (optional, via Razorpay SDK — only a confirmation ID retained). **Encrypted in transit (HTTPS); NOT encrypted at rest** (AsyncStorage chat history is plaintext — do *not* check "encrypted at rest" in the Play form; only JWT/companion memories are in secure storage). No analytics/ads SDKs, no IDFA/GAID, no location/contacts/photos. Data shared only with Razorpay (payment) and the developer's own server; nothing sold.

## 11. iOS privacy manifest & permissions (`app.json`)

`ITSAppUsesNonExemptEncryption: false`; usage strings for microphone (voice input) and photo library. `NSPrivacyTracking: false`; declared accessed-API reasons; collected data types UserID + OtherUserContent (linked, not tracking). Android permissions: `RECORD_AUDIO`, `POST_NOTIFICATIONS`, `MODIFY_AUDIO_SETTINGS`; `softwareKeyboardLayoutMode: "pan"`, `edgeToEdgeEnabled: true`, `predictiveBackGestureEnabled: false`.

## 12. Known fragile areas

- **Version triple-sync** — `package.json` version, `app.json` `expo.version`, `ios.buildNumber` (string) and `android.versionCode` (int) must all agree (buildNumber == versionCode as the same integer). Enforced by `scripts/check-version-sync.js` (`npm run check:version`), `src/__tests__/versionSync.test.ts`, and CI (once the safety-net branch is merged).
- **Two `fetchWithTimeout` helpers** — `src/lib/fetchWithTimeout.ts` (15s default; avoids Hermes-missing `AbortSignal.timeout()`) **and** `src/lib/network/fetchWithTimeout.ts` (20s default, chains an incoming signal). Different call sites import different ones — check which you're touching.
- **Three language-detection implementations** — `aiClient.detectLangFromScript` (routes `/api/chat-reply` formatting; maps *all* Devanagari to `hi`), `aiClient.detectLangFromRomanHints` (transliterated Roman-script Indian langs), and `mobileTTS.detectMessageLang` (picks the TTS voice; has the Marathi/Urdu tiebreak). A fourth exists in the offline engine. They can disagree; covered by `src/__tests__/languageDetection.test.ts`.
- ✅ **RESOLVED 2026-07-18 — launch-flag env-var name mismatch.** `eas.json` sets `EXPO_PUBLIC_LAUNCH_CLOUD_SYNC_FREE_FOR_ALL`, but `HistoryContext.tsx` used to compute the override from a different, never-set env var pair instead. Fixed: the code now reads `EXPO_PUBLIC_LAUNCH_CLOUD_SYNC_FREE_FOR_ALL` directly, and `eas.json`'s `production` value was corrected from `"false"` to `"true"` to match the current soft-launch intent (everyone free for now). Flipping that one value to `"false"` later is now enough to turn on real enforcement.
- **Android keyboard / tab-bar layout** — historically regression-prone (long run of fix commits); no root `KeyboardAvoidingView` by design; tab bar height auto-sized on Android.
- ✅ **RESOLVED 2026-07-18 — tests.** The app historically shipped with zero automated tests. A Jest safety net is now **pushed to `main`** (landed via `git am` as commits `ad80719`/`d0d2cdb`/`8e2a548`/`2cd6018`, not the originally-drafted `d03dade`/`7889964`): 82 tests across 6 suites (`src/__tests__/`: aiClientTone, featureGates, fetchWithTimeout, languageDetection, ttsChunking, versionSync), jest-expo config + native-module stubs (`jest/stubs/`), the version-sync script, and `.github/workflows/ci.yml` (typecheck → version-sync → jest on every push/PR). It also fixed the soft-launch institutional-gate bug (see §4). **CI is now active on the remote.**
