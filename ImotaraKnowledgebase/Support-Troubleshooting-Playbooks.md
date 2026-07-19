# Imotara — Support Troubleshooting Playbooks

*The diagnostic layer of the KB. Symptom-based runbooks for support engineers. Every check is grounded in the shipping code (`imotaraapp` = web + Vercel backend; `imotara-mobile` = Expo/RN app). Cross-reference: "User Support FAQ", "AI, TTS & Language Systems", "Database & Backend Reference", "Licensing, Tiers & Payments", "Imotara Connect".*

**How to use:** match what the user reports to a **Symptom**, work the **Diagnosis steps** in order (they are ordered to disprove the most likely cause first), apply **Resolution**, and **Escalate** only when the runbook says so. "Supabase" below means the SQL editor / table editor in the Supabase dashboard for the Imotara project. "Vercel logs" means the deployment's Runtime Logs, filterable by the bracketed tags shown (e.g. `[tts]`, `[imotara][aiClient]`).

**Escalation inbox:** `info@imotara.com`. ⚠️ **Known trap:** the mobile "You've been signed out" alert tells users to write to `support@imotara.com` — a mailbox that is **not** the documented escalation inbox. See Runbook 1 and Discrepancies.

---

## Quick symptom → runbook index

| User says… | Runbook |
|---|---|
| "Can't log in / sign in fails / got signed out" | 1 |
| "My chats don't show up on my other phone" | 2 |
| "AI stopped answering / replies feel generic" | 3 |
| "Read-aloud is silent / wrong voice" | 4 |
| "It replies in the wrong language" | 5 |
| "I paid and nothing happened" | 6 |
| "Wrong plan / org badge stuck" | 7 |
| "Can't join my organization / invite dead" | 8 |
| "My account/data disappeared" | 9 |
| "Not getting reminders/notifications" | 10 |
| "Can't get into /admin" | 11 |
| "Connect wallet/session broken" | 12 |
| "Is the platform down?" | 13 |
| "The app crashed" | 14 |

---

## Runbook 1 — "I can't sign in"

**Symptom:** User cannot complete sign-in (web or mobile), or gets unexpectedly signed out.

**Likely causes (most→least probable):**
1. Android Google OAuth relay timing — session arrives *after* the browser closes (expected, not a failure).
2. User cancelled/closed the in-app browser before the relay completed.
3. Account is **banned** at the Supabase Auth layer (blocks sign-in and token refresh).
4. Magic link not delivered (web only) — email deliverability.
5. Apple Sign In cancelled or misconfigured.
6. Session fixation gate rejected a deep link the app didn't initiate (rare; user tapped an auth link from outside the app).
7. Stale mobile build calling a retired endpoint.

**Diagnosis steps:**
1. **Establish platform + method.** Mobile offers only **Google, Apple, and anonymous guest** (`src/auth/AuthContext.tsx`, `SignInPrompt.tsx`) — there is **no email magic-link on mobile**. Magic link is a **web-only** path (`/auth/callback`). If a mobile user is "waiting for a magic-link email," that's the confusion — direct them to Google/Apple.
2. **Android + Google, "it flashed and did nothing":** This is usually success. On Android the relay page (`https://imotara.com/auth/callback-mobile`) fires `imotara://auth/callback#<tokens>` as a system intent; `signInWithGoogle()` returns `{success:false}` synchronously but polls for **5 seconds (700 ms intervals)** and the session often lands async via `onAuthStateChange`. Ask them to wait ~5s / reopen the app — if signed in, it worked.
3. **"Sign-in failed" alert:** Two distinct strings, both from `AuthContext.tsx`:
   - "Could not start Google sign-in…" → OAuth init failed (`signInWithOAuth` returned no URL). Check Supabase Auth is up (Runbook 13) and that Google provider is enabled.
   - "An unexpected error occurred during Google/Apple sign-in…" → exception mid-flow.
4. **"You've been signed out" → "Your session has ended unexpectedly…":** This fires only when a **real session was lost via a `SIGNED_OUT` event that the app did not initiate** (`applySession`, `wasAuthenticatedRef` + `explicitSignOutInFlight` guards). **The overwhelmingly likely cause is a ban/suspension.** Verify in Supabase:
   ```sql
   -- Is this user banned at the Auth layer? (authoritative)
   select id, email, banned_until, updated_at
   from auth.users where email = 'user@example.com';
   -- Audit trail of admin-initiated bans (who/why):
   select * from user_bans where user_id = '<uuid>' and unbanned_at is null;
   ```
   A ban is applied via `auth.admin.updateUserById(ban_duration:"876000h")` (~100 yrs) from `POST /api/admin/users/[userId]/ban`; `banned_until` will be far in the future. The `user_bans` row is **audit only** — the real block lives in `auth.users.banned_until`.
5. **"I was banned but could still use it for a while":** Expected. A ban blocks **new sign-ins and token refresh**, but an **already-issued Supabase access token (JWT) stays valid until it expires (~1 hour default).** So a banned user keeps working until their current token lapses, then the refresh fails and the "You've been signed out" alert appears. There is no forced instant kill.
6. **Magic link not arriving (web):** Confirm the address, check spam, and confirm Supabase Auth SMTP/email provider is configured and not rate-limited. The link completes at `/auth/callback`.
7. **Very old app version:** If a user's client hits `POST /api/imotara-ai` and gets `410 { error:"deprecated_route", message:"This endpoint has been retired. Use POST /api/respond instead." }`, they are on a **stale build**. Have them update from the store.

**Resolution:**
- Android timing → reassure; wait 5s / reopen.
- Banned in error → an admin unbans via `DELETE /api/admin/users/[userId]/ban` (sets `ban_duration:"none"`, stamps `user_bans.unbanned_at`). Tell the user it may take **up to ~1 hour** for a fresh token to issue if they were mid-session; signing out and back in is immediate.
- Magic link → resend; if repeated failures, check Supabase email logs.
- Apple "ERR_CANCELED" → user dismissed the sheet; not an error, retry.

**Escalate when…** ban status in `auth.users` disagrees with what the user/admin expects; `banned_until` is set but no `user_bans` row (banned directly in Supabase, not via the admin route — needs investigation); or OAuth init fails for **all** users (provider/Supabase outage → Runbook 13).

---

## Runbook 2 — "My chats aren't syncing between devices"

**Symptom:** History created on one device doesn't appear on another (or on web).

**Likely causes:**
1. **`analysisMode = "local"`** — privacy setting that intentionally never touches the cloud.
2. No **`chatLinkKey`** scope set → remote **pull** is skipped (push may still run, but nothing comes back).
3. Not signed in / cloud sync gated off by plan.
4. Items still flagged **unsynced** (`isSynced:false`) and a push hasn't completed.
5. Different identity scope on each device (guest vs signed-in, or different `chatLinkKey`).

**Diagnosis steps:**
1. **Check analysis mode first.** Settings → analysis mode (Auto / Cloud / **Local**). In `ChatScreen.tsx` the sync effect starts with `if (analysisMode === "local") return;` — **Local mode disables cloud sync entirely by design.** If set to Local, that's the whole answer.
2. **Check the sync status strip** (Settings, `lastSyncStatus`). The exact strings map to states (`HistoryContext.tsx`):
   - "Synced N item(s) from this device to Imotara cloud." → push succeeded.
   - "Sync checked · nothing new to push from this device." → no `isSynced:false` items to send.
   - "Sync failed: <error>" / "Sync error: <error>" → network/backend error on push.
   - "Cloud sync is not available on your plan." → `cloudSyncAllowed` gate is off (status `-4`).
3. **Confirm identity scope.** Sync data is partitioned by `chatLinkKey` (see `scopedKey()`). On first sign-in the app auto-sets `chatLinkKey = user.id.slice(0,80)`. **The remote pull is skipped when `chatLinkKey` is empty** (`runSync`: `if (!historyScope) return pushRes;`). So a guest/anonymous device pushes nothing meaningful and pulls nothing. Both devices must be **signed into the same account** (same auth `user.id` → same `chatLinkKey`), or have the **same manually-set cross-device sync key**.
4. **Confirm the push actually reached the backend.** Mobile pushes to `POST /api/history` with body `{ records:[...] }` (**max 50 items/push**). In Supabase:
   ```sql
   select id, user_scope, role, left(content,40) as preview, created_at
   from imotara_chat_messages
   where user_scope = '<auth user id or chatLinkKey>'
   order by created_at desc limit 20;
   ```
   (History rows for signed-in users key on the user's id; the pull uses `GET /api/history?since=<ms>`.)
5. **Unsynced backlog.** Any item with `isSynced:false` is pending. New local items default to `isSynced:false` until a successful push flips them to `true`. FREE-tier retention **never deletes unsynced items** (prevents data loss), so a growing local store with old timestamps = pushes have been failing.

**Resolution:**
- Local mode → switch to Auto/Cloud if the user wants cross-device.
- Empty scope → sign in on both devices (same account) or set the same sync key.
- Gated plan → cloud sync availability follows the license gate (`gate("CLOUD_SYNC", tier)`); during the launch phase `LAUNCH_CLOUD_SYNC_FREE_FOR_ALL` overrides it for everyone — if that override is off and the user is FREE, sync is expected to be blocked.
- Failing pushes → check connectivity; trigger a manual sync (foreground the app / Settings sync button). Throttle note: manual `runSync` bursts within 900 ms are rejected ("Sync trigger throttled").

**Escalate when…** rows are present in `imotara_chat_messages` for the correct scope but the second device still won't pull after a confirmed non-empty `chatLinkKey`, or the sync strip shows repeated "Sync failed" with a 5xx from `/api/history`.

---

## Runbook 3 — "The AI stopped replying / replies feel canned"

**Symptom:** Replies stopped, or feel generic/templated instead of the usual cloud quality.

**Likely causes:**
1. **Daily quota exhausted** → client silently uses the **local/offline** reply engine (template-based, noticeably more generic).
2. **OpenAI outage** → automatic **Gemini fallback** (still cloud, near-normal quality).
3. Both cloud routes failed/timed out → local engine.
4. No API key configured (`meta.from:"disabled"`).

**Diagnosis steps:**
1. **Ask what "canned" looks like.** The offline engine uses a fixed Three-Part Framework and native-wisdom fragments — repetitive openers, no nuance/sarcasm handling. That signature = local fallback fired.
2. **Confirm which path fired via `meta.from`** in the response (mobile logs it; the field is authoritative). Values:
   - `openai` → normal cloud (OpenAI `gpt-4.1-mini`).
   - `fallback` → **Gemini** `gemini-2.0-flash` (OpenAI was down/errored).
   - `quota_exceeded` → daily limit hit; client then renders a **local** reply.
   - `disabled` → `OPENAI_API_KEY` not set.
   - `error` → both providers failed.
3. **Quota check.** Both `/api/respond` and `/api/chat-reply` gate FREE users at **20 cloud replies/day** (UTC midnight reset). On exhaustion they return `200 { message:"", meta:{ from:"quota_exceeded", reason:"daily_limit", limit:20 } }` (chat-reply also includes `used`). Verify in Supabase:
   ```sql
   -- Replies used today (UTC) for this user:
   select count(*) from usage_events
   where user_id = '<uuid>'
     and created_at >= date_trunc('day', now() at time zone 'utc');
   -- Their tier + token balance (tokens decrement before the block):
   select tier, expires_at, token_balance from licenses where user_id = '<uuid>';
   ```
   If `count >= 20`, tier is `free`/expired, and `token_balance = 0` → they're on local fallback. Purchased token packs decrement one-by-one first.
4. **Outage check (Gemini path).** If `meta.from:"fallback"`, OpenAI errored. A throttled red-alert email (subject **"🔴 ALERT: OpenAI API unavailable — Gemini fallback active"**, ≤1 per 5 min per instance) goes to `info@imotara.com`. In Vercel logs search `[imotara][aiClient] OpenAI error HTTP` or `[imotara][aiClient] fetch exception`. Confirm https://status.openai.com.
5. **Disabled/error.** `meta.from:"disabled"` → `OPENAI_API_KEY` missing in Vercel env. `error` with `GEMINI_API_KEY not set` → both keys absent.

**Resolution:**
- Quota → buy a token pack or upgrade; or wait for UTC midnight reset. (Enforcement is **fail-open** — DB errors never block, so a "no replies at all" symptom is *not* the quota system.)
- Gemini fallback → nothing to fix client-side; monitor until OpenAI recovers. Reassure that replies still work.
- Disabled/error → ops must set `OPENAI_API_KEY` (and `GEMINI_API_KEY` for DR) in Vercel Production env.

**Escalate when…** `meta.from:"error"` (both providers down), or quota query shows `count < 20` yet the user still gets local replies (possible auth/identity mismatch — the quota only counts verified users; a forged/unsigned bearer never satisfies the verified-identity gate).

---

## Runbook 4 — "Voice / read-aloud is silent or wrong"

**Symptom:** No audio, wrong gender, wrong language, or a "voice not available" toast.

**Likely causes:**
1. Anonymous **15 TTS/day** cap hit → `429`.
2. Device has **no installed voice** for the language (notably Samsung) → silent native TTS, app shows a toast.
3. Azure region/key misconfig → `502`/`503` from `/api/tts`.
4. Wrong gender → native OEM voice used (ignores gender) instead of Azure.
5. Browser using its own `speechSynthesis` for that language.
6. Text over the 8,000-char hard cap → `400`.

**Diagnosis steps:**
1. **Signed in or guest?** `/api/tts` gives signed-in accounts **unlimited** Azure TTS. Anonymous identities are capped at **15/day**; on exceed the route returns `429 { error:"Daily voice limit reached. Sign in for unlimited voice.", code:"quota_exceeded" }`. Verify:
   ```sql
   select count(*) from usage_events
   where user_id = '<uuid>' and event_type = 'tts'
     and created_at >= date_trunc('day', now() at time zone 'utc');
   ```
2. **Silent on a specific language, especially Samsung/Android:** `mobileTTS.ts` `playNativeFallback` calls `hasNativeVoice(lang)`; if false it fires `onUnavailable()` (the "install the language's TTS voice in device settings" toast) instead of silently producing nothing. Some Android engines (Samsung's) yield **no sound and no error** when the voice isn't installed — the toast is the signal. Fix: device Settings → install the language TTS voice / switch TTS engine to Google.
3. **Wrong gender:** Chat read-aloud routes through **Azure Neural TTS** precisely because native `expo-speech` ignores gender. Voice follows the **companion gender** setting via `voices.ts`. If gender is wrong, either the request fell back to native (Azure failed — check step 4) or the companion gender setting is wrong. Nonbinary/other/prefer-not intentionally map to the neutral (female) voice.
4. **`/api/tts` server errors (Vercel logs, tag `[tts]`):**
   - `503` "Azure not configured" → `[tts] config error` (region/key env missing).
   - `502` "TTS service unavailable" → `[tts] Azure fetch failed` (network to Azure).
   - `502` "TTS synthesis failed" → `[tts] Azure error <status>` (Azure rejected the SSML/key). Look for `region=` in `[tts] azure fetch done` to confirm routing (region derives from `x-vercel-ip-country`, defaults India).
   - `400` "text too long (max 8000 chars)" → oversized input.
5. **Web, "it speaks but sounds like the OS voice":** On web `/api/tts` is only called when the browser **lacks** a native voice for the language; otherwise the browser's `speechSynthesis` is used (with a `resume()` keep-alive). That's expected behavior, not a bug.
6. **Wrong language spoken:** the voice's language detection is separate from chat detection — see Runbook 5.

**Resolution:** sign in (removes 15/day cap); install device voice / switch TTS engine (Samsung); ops fix Azure `region/key` env if `[tts]` shows 502/503 for all users; correct companion gender in Settings.

**Escalate when…** `[tts]` logs show 502/503 across many users (Azure outage/key rotation) or `429` for a **signed-in** user (quota should never apply to real accounts — indicates the request was treated as anonymous, an auth bug).

---

## Runbook 5 — "Wrong language replies"

**Symptom:** Imotara answers in a different language/script than the user wrote.

**Likely causes:**
1. Romanized text below the **2-hit** detection threshold → falls to English or the wrong language.
2. Known confusions: **Gujarati↔Bengali** (romanized), **Marathi↔Hindi** (shared Devanagari).
3. Conversation continuity carried the previous language into an ambiguous turn.
4. Latin-heavy message forced to English by the hard override.

**Diagnosis steps (detection pipeline order — `derivePreferredLanguage` in `/api/respond`, mirrored on mobile):**
1. **Get the exact input text.** Detection is content-only — language is **never** inferred from name or device locale.
2. **Explicit request / client code** wins first (e.g. "reply in Tamil", or an explicit Indic code with Roman-script text).
3. **Hard English override:** Latin-heavy text (≥80% Latin letters) with **fewer than 2** romanized Indic/foreign hits is forced to English. A single stray English word in an Indic message won't break it (threshold is `< 2`, not `0`), but a **mostly-English short message will always answer in English** even if a preference is set — by design.
4. **Unicode script** ranges (Bengali, Devanagari letters *excluding* the danda `।`, Tamil, etc.). Note: `।` is deliberately **not** treated as Hindi because many Bengali users type it.
5. **Romanized banks** need **≥2 hits** and the strongest signal wins (`keywordMaps.ts`). This is where confusions live:
   - **Gujarati romanized** sometimes scores as **Bengali** — if a Gujarati user typing in Latin gets Bengali, this is the known limitation.
   - **Marathi** shares Devanagari with **Hindi**, so Marathi script can read as Hindi; only conservative Marathi romanized hints disambiguate.
6. **Continuity:** only when the current message is ambiguous does it inherit the **last assistant language** (e.g. `lastWasBn`/`lastWasHi`). An English message is protected from being dragged back into bn/hi by a belt-and-suspenders check.
7. **Explicit switch phrases** override continuity — regex matches `english|in english|switch to english|বাংলা|bangla|bengali|hindi|हिंदी|in hindi|switch to hindi`.

**Resolution:**
- Tell the user to **explicitly ask** ("reply in Gujarati") or set the language preference — explicit + Indic code short-circuits the ambiguous romanized path.
- For romanized Gujarati/Marathi, typing a few words in **native script** forces correct detection via the script layer (step 4).
- Continuity slip (e.g. drifts around turn 3) → an explicit switch phrase resets it immediately.

**Escalate when…** a **native-script** message (unambiguous Unicode range) is answered in the wrong language — that's a genuine detection bug, not a threshold edge case; capture the exact text and turn number.

---

## Runbook 6 — "I paid but nothing happened"

**Symptom:** Payment/donation succeeded on the user's side but no plan/receipt appears. (Short version — full flows live in "Licensing, Tiers & Payments".)

**Likely causes by rail:**
- **Razorpay (web/Android):** webhook not reaching **production** backend, or verify-payment lag.
- **Apple IAP (iOS):** receipt not yet restored → use **Restore Purchases**.
- **Google Play:** purchase-token re-verify pending.
- **Donations:** webhook signature/secret mismatch.

**Diagnosis steps:**
1. **Platform health first:** open `https://<prod-domain>/api/health`. It returns `ok:true` (HTTP 200) only when Razorpay + Supabase env flags are all present; `ok:false` (HTTP 500) means env vars are missing — **stop and fix env before anything else** (it never leaks secret values, only presence booleans).
2. **Razorpay webhook health** (from `WEBHOOK_PROD_CHECK.md`):
   - Confirm the Razorpay dashboard webhook URL is exactly `https://<prod-domain>/api/payments/razorpay/webhook` (**not** localhost/preview).
   - Confirm `RAZORPAY_WEBHOOK_SECRET` in Vercel Production matches the dashboard secret; `RAZORPAY_KEY_ID`/`RAZORPAY_KEY_SECRET` set.
   - Subscribed events include `payment.captured` and `order.paid`.
   - In Vercel logs search **"✅ Razorpay webhook verified"**. If the dashboard says "Delivered" but no receipt, the signature likely failed (secret mismatch) or the URL points at the wrong environment.
3. **Verify the receipt row** in Supabase:
   ```sql
   select provider, razorpay_payment_id, amount, created_at
   from donations order by created_at desc limit 10;
   -- License grants (paid tiers):
   select user_id, tier, expires_at from payment_licenses order by created_at desc limit 10;
   ```
   The `donations` table has a unique constraint on `(provider, razorpay_payment_id)` — a missing row after a "Delivered" webhook points at signature/URL/env, not duplication.
4. **Apple:** have the user tap **Restore Purchases** (re-verifies with Apple via `/api/license/verify-apple-purchase`). Apple/Google subs cannot be cancelled server-side.

**Resolution:** fix webhook URL/secret/env per steps 1–2; Restore Purchases (Apple); if payment is confirmed at the rail but the license row is genuinely absent, an admin can grant the license manually and open a payment investigation.

**Escalate when…** `/api/health` is `ok:true`, Vercel shows "✅ Razorpay webhook verified", but no `donations`/`payment_licenses` row appears — indicates a DB write failure or constraint issue; escalate with the payment ID.

---

## Runbook 7 — "My org badge / tier is wrong or stale"

**Symptom:** "Managed by [org]" badge is missing, wrong, or stuck after an org change; tier doesn't match reality.

**Likely causes:**
1. Cached org context not refreshed since the change.
2. Tier priority resolved to a different source than the user expects.
3. Seat released (removed from org) but client cache stale.

**Diagnosis steps:**
1. **The authoritative source is `/api/license/status`**, which calls `resolveUserTier()` → RPC **`resolve_user_tier`**. Priority chain (higher wins): **pool_assignment > org_override > org_tier > personal > free**. A direct read of the `licenses` table **misses pool assignments and tier overrides** — never diagnose from `licenses` alone.
   ```sql
   select * from resolve_user_tier('<user uuid>');   -- effective_tier, tier_source, org_id, org_role, status...
   select id, name, seats_purchased, seats_used, status from organizations where id = '<org uuid>';
   select org_id, user_id, role, status from org_members where user_id = '<user uuid>';
   ```
2. **When does the client refresh?** `refreshLicense()` (mobile `SettingsContext.tsx`) fires on `SIGNED_IN`, `INITIAL_SESSION`, and `TOKEN_REFRESHED` auth events, and writes org context to AsyncStorage key **`imotara_org_context_v1`**. A **mid-session** org change (e.g. removed from org) previously left a stale "Managed by" badge until app restart — `refreshLicense` on auth events fixes it, but if the app hasn't seen a qualifying event, the badge is stale.
3. **Expiry:** `/api/license/status` and `resolveUserTier` both downgrade to `free`/`expired` when `expires_at < now()`. A "was Pro, now Free" complaint is often just expiry.
4. **Seat released:** if `org_members.status` for the user is not `active` (or the row is gone) but the badge persists, it's a stale cache.

**Resolution:** force a refresh — sign out/in, or any action that triggers `TOKEN_REFRESHED`, re-runs `refreshLicense()` and rewrites `imotara_org_context_v1`. Confirm the real state with `resolve_user_tier(...)`. If `org_context` key holds an org the RPC no longer returns, clearing app storage / reinstalling clears it (and it re-populates correctly).

**Escalate when…** `resolve_user_tier()` returns a tier that contradicts the org's actual seat/pool config, or `seats_used` is inconsistent with the count of active `org_members` (seat-accounting drift — see Runbook 8's one-seat rule).

---

## Runbook 8 — "Org member can't join / invite not working"

**Symptom:** Invite link errors, or joining fails.

**Likely causes:**
1. Invite **expired** or **already accepted**.
2. Signed-in email ≠ invite email.
3. Org **seats full**.
4. User already holds a paid seat in another org (one-seat rule releases the old one first).

**Diagnosis steps (grounded in `GET/POST /api/org/invite/[token]`):**
1. **Map the HTTP status the invite page returns:**
   - `404 "invite not found"` → bad/rotated token.
   - `409 "invite already accepted"` / "already accepted" → single-use token already consumed.
   - `410 "invite expired"` / "expired" → `org_invites.expires_at < now()`.
   - `403 "This invite was sent to <email>. Please sign in with that email."` → the invite is bound to a specific recipient; the current account's email doesn't match. Invites are **single-use and recipient-bound** — domain match does **not** let a different user consume someone else's token.
   - `409 "You are already a member of this organisation"` → active `org_members` row exists.
   - `409` with a seat error → `assignOrgLicense` failed because seats are full (the member insert is then **rolled back**).
   ```sql
   select token, email, role, expires_at, accepted_at, org_id from org_invites where token = '<token>';
   select seats_purchased, seats_used, status from organizations where id = '<org uuid>';
   ```
2. **Domain auto-join** is a **separate** endpoint: `/api/org/join-by-domain` (for EDU/NGO orgs with `org_settings.auto_join_by_domain`). If the user's email domain qualifies but they have no personal invite, route them there (the invite page surfaces `/org/join/[slug]` as the alternative).
3. **One-paid-seat-per-user rule:** on accept, `releasePriorOrgMembership(userId, newOrgId)` revokes any **different** active membership first, so a user can't occupy two paid seats. If a user reports "I joined Org B and got kicked from Org A," that's this rule working as intended.

**Resolution:** re-issue a fresh invite (new token, future `expires_at`) for expired/accepted cases; have the user sign in with the exact invited email; org owner frees or buys seats if `seats_used >= seats_purchased`; use domain-join for eligible domains.

**Escalate when…** seats show available (`seats_used < seats_purchased`) but `assignOrgLicense` still 409s, or `seats_used` doesn't match active member count (seat-accounting drift needs a manual correction).

---

## Runbook 9 — "My account was deleted / my data is gone"

**Symptom:** User says their data vanished, or wants confirmation of deletion.

**Likely causes:**
1. **Anonymous vs signed-in identity confusion** (mobile) — data was under a guest identity, not their account.
2. Local storage cleared / app reinstalled (local-only data is device-local).
3. An actual account deletion ran.
4. Sync scope mismatch (see Runbook 2) — data exists, just not visible on this device.

**Diagnosis steps:**
1. **Was the data ever in the cloud?** If the user was **anonymous** (guest), their data lived under an anonymous Supabase identity and **device-local storage**. Mobile keeps two tokens deliberately: `accessToken` (real account) vs `anonymousAccessToken` (guest — used only for TTS/transcription). Guest data does **not** survive reinstall and is **not** cross-device. "I reinstalled and lost everything" + never signed in = expected, not a deletion.
2. **Confirm whether a delete ran.** Account deletion is `DELETE /api/account/delete` (and web `/api/delete-remote`). It removes, in order: `imotara_history` (rows `like '<userId>:%'`), `user_memory` (all types incl. push subs), `licenses`, `payment_licenses`, `usage_events`, then the **Supabase auth user** (permanent). Mobile clears AsyncStorage *before* calling it. Check:
   ```sql
   select id, email, created_at from auth.users where email = 'user@example.com'; -- gone if fully deleted
   select count(*) from imotara_history where id like '<uuid>:%';
   select count(*) from user_memory where user_id = '<uuid>';
   ```
   If `auth.users` still has the row but tables are empty, deletion partially ran (`partialErrors` would have been returned) — see escalation.
3. **Data exists but not showing** → this is a sync/scope problem, go to Runbook 2 (check `chatLinkKey`, `analysisMode`).

**Resolution:** if guest confusion, explain that signing in enables cloud backup going forward (lost guest data can't be recovered). If they *wanted* deletion, confirm it completed (no `auth.users` row). If data exists under the right scope, fix visibility via Runbook 2.

**Escalate when…** the delete endpoint returned `500 { error:"failed_to_delete_auth_user", partialErrors:[...] }` (auth user survived but data rows were removed — an inconsistent state needing manual cleanup), or a user reports deletion they didn't request (security — check `user_bans`/admin activity).

---

## Runbook 10 — "Push / check-in notifications not arriving"

**Symptom:** No daily check-in reminder, inactivity nudge, or web push.

**Likely causes:**
1. OS notification permission not granted.
2. (Web) push subscription missing / VAPID or service worker issue.
3. User is **active** (the daily nudge cron intentionally skips active users).
4. Cooldown window not elapsed.
5. Expo module unavailable (Expo Go dev builds).

**Diagnosis steps:**
1. **Mobile (Expo Notifications).** Reminders use `expo-notifications` (`checkInReminder.ts`). Permission gate: `requestNotificationPermission()` → returns false if not `granted`; scheduling silently no-ops without it. The daily check-in is a `DAILY` trigger (default **20:00 local**); the inactivity nudge is a one-shot `TIME_INTERVAL` after **48h** of silence (`DEFAULT_INACTIVITY_HOURS`). In Expo Go the native module isn't linked (`getNotifications()` returns null) → nothing schedules; needs a dev/store build.
2. **Web push (VAPID + service worker).** Subscription is saved via `POST /api/push/subscribe` into `user_memory` (`type='push', key='subscription'`). Verify:
   ```sql
   select user_id, updated_at from user_memory where type='push' and key='subscription' and user_id='<uuid>';
   ```
   No row → the browser never subscribed (permission denied, or service worker/VAPID key issue). A `410 Gone` from the push service marks the subscription stale.
3. **Server-side nudge cron** `/api/push/cron` runs **daily 09:00 UTC** (`vercel.json`: `"0 9 * * *"`). It:
   - **Skips active users** — anyone with a `chat_reply` `usage_events` row in the last **48h** is considered active and gets nothing.
   - Enforces a **24h cooldown** per user (`user_memory` `key='last_notified_at'`).
   - Deletes stale subscriptions on `410`.
   Requires `CRON_SECRET` (returns `401 Unauthorized` without the `Bearer <CRON_SECRET>` header; `500` if the secret env is unset). Confirm the cron ran (Runbook 13) and search logs for `[push/cron]`.
4. **"I get web push but not the daily reminder on mobile"** (or vice-versa) → they're independent systems; diagnose each separately.

**Resolution:** re-grant OS permission; re-subscribe on web (toggle the setting off/on to re-run `/api/push/subscribe`); explain the active-user skip and 24h cooldown (an engaged user won't get nudges — that's intended). Ensure a real build (not Expo Go) on mobile.

**Escalate when…** a subscription row exists, the user is genuinely inactive >48h, cooldown elapsed, yet `[push/cron]` shows `sent` not incrementing for them — or the cron itself isn't firing (Runbook 13).

---

## Runbook 11 — "Admin can't log in to /admin"

**Symptom:** Super-admin can't sign into `/admin`.

**Likely causes:**
1. **Account lockout** after 5 failed attempts.
2. 2FA challenge not completed.
3. Session expired (8h).
4. First-time seed already done (409).
5. Inactive/wrong account.

**Diagnosis steps (`POST /api/admin/auth/login`, `adminCrypto.ts`):**
1. **Lockout:** after **5 failed attempts** (`MAX_FAILED_ATTEMPTS`) the account locks for **15 minutes** (`LOCKOUT_DURATION_MS`). Login returns `429 { error:"Account is temporarily locked. Try again in N minutes.", locked:true, retryAfterSeconds }`. Before lockout, `401` responses count down: "…N attempts remaining before lockout." Check:
   ```sql
   select email, active, failed_attempts, locked_until, last_failed_at, last_login_at
   from super_admins where email = 'admin@example.com';
   select * from admin_login_audit where email='admin@example.com' order by created_at desc limit 10;
   ```
2. **2FA:** if `totp_enabled`, login must complete the challenge via `POST /api/admin/auth/2fa/verify` (`{code, loginToken}`) which sets `admin_sessions.two_fa_verified=true`. A `400 "Incorrect code — try again"` = wrong TOTP; backup codes were issued at 2FA setup.
3. **Session length:** admin sessions last **8 hours** (`SESSION_TTL_MS`), cookie `imotara_admin_session` (httpOnly). Expired sessions are cleaned on next login. "Logged in this morning, kicked out this afternoon" = normal 8h expiry.
4. **Inactive account:** `401 "Invalid email or password."` with audit `failure_reason='account_inactive'` → `super_admins.active=false`.
5. **Seed:** first owner is created once via `POST /api/admin/auth/seed`; after the table is non-empty it returns `409 "Seed already done — super_admins table is not empty"`. If someone is trying to seed an existing install, that's expected — they should log in, not seed.

**Resolution:**
- Locked → wait 15 min, or an owner clears `locked_until`/`failed_attempts`:
  ```sql
  update super_admins set failed_attempts=0, locked_until=null where email='admin@example.com';
  ```
- Forgot password → `POST /api/admin/auth/forgot-password` → reset flow (`/api/admin/auth/reset-password`).
- 2FA device lost → use a backup code; owner can disable via `/api/admin/auth/2fa/disable`.
- Session expired → just log in again.

**Escalate when…** the `super_admins` row is missing entirely (no admin exists — needs a controlled re-seed), or repeated `500 "Session creation failed."` (DB write failure on `admin_sessions`).

---

## Runbook 12 — "Connect session / wallet problems"

**Symptom:** Connect session stuck, wallet balance wrong, recharge blocked, or refund status unclear.

**Likely causes:**
1. **Stale pending recharge** blocking new recharges (unique index) until the 30-min cron clears it.
2. **Orphaned active session** (client crashed) — auto-completed by the 10-min cron.
3. Consultant push token missing.
4. Recharge/topup verify lagged.

**Diagnosis steps:**
1. **"I can't recharge — it says one is pending":** the `uq_connect_recharges_user_consultant_pending` unique index blocks a new recharge for the same user+consultant while a `pending` row exists. Razorpay auto-expires orders after 15 min, but if `payment.failed` isn't delivered the row stays `pending`. The cron `/api/cron/connect-recharge-expiry` (**every 30 min**, `"*/30 * * * *"`) flips `pending → failed` after **30 minutes**. Check:
   ```sql
   select id, status, created_at from connect_recharges
   where user_id='<uuid>' and status='pending' order by created_at desc;
   ```
   If a stale pending row is <30 min old, the user just needs to wait for the cron; if older and still pending, the cron may not be running (Runbook 13).
2. **Session stuck "active" after the call ended:** `/api/cron/connect-orphans` (**every 10 min**, `"*/10 * * * *"`) auto-completes active sessions with **no tick for >15 min**, credits the consultant **80%** of `minutes_used × rate` (20% platform fee), clears `is_busy`, and pushes the user a **"Session Ended — Your session was closed due to inactivity."** notification. Scheduled sessions with no tick are **not** killed (legitimately waiting). Check:
   ```sql
   select id, status, minutes_used, last_tick_at, started_at, type
   from connect_sessions where id='<session uuid>';
   ```
3. **Consultant not getting session pushes:** push uses `auth.users.user_metadata.expo_connect_push_token` via `exp.host/--/api/v2/push/send`. A null token → no notifications; the consultant must have registered it (`/api/connect/user/push-token`).
4. **Refund status:** requests go through `/api/connect/wallet/refund-request`; check the wallet/refund tables and admin refunds view (`/api/admin/connect/refunds`).

**Resolution:** wait for the relevant cron (or an admin fires it — Runbook 13); confirm consultant push-token registration; for a genuinely stuck orphan past 15 min that the cron didn't catch, check the cron ran.

**Escalate when…** `[connect-orphans]` logs show **CRITICAL** (wallet upsert / `increment_wallet_earnings` / `increment_sessions_completed` failed — earnings/session-count discrepancy needing manual correction), or a recharge stayed `pending` well beyond 30 min (cron not firing).

---

## Runbook 13 — Platform health (is something actually down?)

**Use this to triage whether an issue is user-specific or platform-wide before deep-diving other runbooks.**

**Checks:**
1. **`/api/health`** — `GET https://<prod-domain>/api/health`. `ok:true` (200) requires Razorpay (`KEY_ID`, `KEY_SECRET`, `WEBHOOK_SECRET`) **and** Supabase (`URL` + `SERVICE_ROLE_KEY` or `ANON_KEY`) env flags all present. `ok:false` (500) = an env var is missing in Production — a deploy/config problem, not user error. It only reports presence booleans, never secret values.
2. **Vercel crons ran?** Schedules (`vercel.json`):
   | Path | Schedule | Purpose |
   |---|---|---|
   | `/api/push/cron` | `0 9 * * *` (09:00 UTC daily) | inactivity nudges |
   | `/api/cron/exchange-rates` | `0 2 * * *` | FX rates |
   | `/api/cron/connect-orphans` | `*/10 * * * *` | kill stalled Connect sessions |
   | `/api/cron/connect-recharge-expiry` | `*/30 * * * *` | expire stale recharges |
   | `/api/cron/connect-scheduled` | `0 * * * *` (hourly) | scheduled sessions |
   | `/api/cron/wallet-reminders` | `30 2 * * *` | wallet reminders |
   | `/api/cron/wallet-expiry-notice` | `0 3 * * *` | wallet expiry notice |
   | `/api/cron/wallet-dormant` | `30 3 * * *` | dormant wallets |
   (`wallet-forfeit` was removed from the schedule 2026-07-18 and its route file deleted 2026-07-19 — dormant is the only wallet-lifecycle cron now.)
   Check the Vercel dashboard Cron tab for last-run status; each returns `401` if `CRON_SECRET` is wrong/missing. An admin can trigger one manually with the correct `Authorization: Bearer <CRON_SECRET>` header.
3. **Supabase status** — dashboard project health / status.supabase.com. Auth outage surfaces as sign-in failures (Runbook 1); DB outage surfaces as fail-open behaviors (quota not enforced, license falls back to free).
4. **AI outage alert email** — subject **"🔴 ALERT: OpenAI API unavailable — Gemini fallback active"** to `info@imotara.com` means OpenAI errored and traffic auto-switched to Gemini. Replies still work (`meta.from:"fallback"`); this is informational, throttled to 1 per 5 min per instance. Confirm at status.openai.com.

**Escalate when…** `/api/health` is `ok:false` in Production, a cron hasn't run for well over its interval, or Supabase/OpenAI status pages show an active incident.

---

## Runbook 14 — App crashes on mobile

**Symptom:** The mobile app shows the "💔 Something went wrong" screen (React error boundary).

**Diagnosis steps (`App.tsx` `ErrorBoundary`):**
1. **What the user sees:** a full-screen "Something went wrong / Your data is safe — tap below to restart" with **Restart app** (resets the boundary, no reload) and **Send crash report** (opens a `mailto`).
2. **What the crash report contains** (`buildCrashMailto`): a `mailto:info@imotara.com` with subject **"[Imotara] Crash Report"** and body = **app version**, **platform (`Platform.OS` + `Platform.Version`)**, **error name + message**, **stack**, and **React component stack**. Ask the user to actually send it — that's your primary artifact.
3. **Collect from the user:** app **version/build number**, **platform + OS version**, whether it's a **store build or an OTA update**, and repro steps. (Version resolves from `expoConfig.version` / `manifest2`.)
4. **Config-error screen (distinct from a crash):** "App Configuration Error — Missing EXPO_PUBLIC_IMOTARA_API_BASE_URL" appears only in non-dev builds where the API base URL env wasn't set at build time. This is a **build/release** problem (EAS env), not a user crash — the app never reached the network.
5. **OTA vs store build:** an **OTA update** can ship JS that crashes on top of an older native binary; a **store build** bundles native + JS together. If crashes started right after an OTA, suspect the OTA payload and consider rolling it back; if only on specific OS versions, suspect a native/store-build mismatch.

**Resolution:** have the user Restart (recovers most transient render errors) and **send the crash report**; if reproducible, capture version/platform/OTA-vs-store and file it. For the config-error screen, ops must set `EXPO_PUBLIC_IMOTARA_API_BASE_URL` in the EAS/Expo build env and re-release.

**Escalate when…** multiple users on the **same version/OS** hit the boundary (systemic regression — likely a bad OTA or release), or the config-error screen appears in a production build (release misconfiguration).

---

## Discrepancies & traps found (worth fixing / knowing)

1. ✅ **RESOLVED 2026-07-18 — ban alert pointed to an undocumented mailbox.** The mobile "You've been signed out" alert (`AuthContext.tsx`) used to tell users to contact `support@imotara.com`, inconsistent with the escalation inbox everywhere else in mobile (`info@imotara.com`). Fixed — the alert now says `info@imotara.com`. (Note: `support@imotara.com` remains the correct, deliberately-used address for Connect/wallet support specifically — see `src/lib/wallet/mailer.ts`/`src/lib/connect/mailer.ts` — this was only ever a mobile-specific inconsistency, not a sign the address itself is wrong.)
2. **Free daily reply limit is 20/day.** Both `/api/respond` and `/api/chat-reply` enforce **20** (`limit:20`, `count >= 20`). `docs/LICENSING.md` used to say "10/day" in one table — resolved 2026-07-19, now consistent at 20/day throughout that doc too.
3. **`/api/imotara-ai` is retired (410).** It returns `410 { error:"deprecated_route", canonical:"/api/respond" }`. Live clients use `/api/chat-reply` (primary) and `/api/respond` (fallback). A user hitting the 410 is on a **stale build** — a useful signal, but note the KB's "reply pipeline" naming assumes current builds.
4. ✅ **RESOLVED 2026-07-18 — `user_bans` was audit-only; the ban-status endpoint used to trust it as truth.** A ban applied directly in Supabase (not via the admin route) left no `user_bans` row, so `GET /api/admin/users/[userId]/ban` could report "not banned" for a genuinely banned user. Fixed — the endpoint now reads `auth.admin.getUserById(userId).banned_until` as the authoritative source, with `user_bans` kept only as supporting context (who/why/when). Verified live: banned a test user directly via Supabase with no audit row, confirmed the endpoint correctly reported `banned:true`.
5. **No email magic-link on mobile.** The FAQ lists magic-link as a sign-in method; on mobile only Google/Apple/anonymous exist. Magic-link is web-only. Support should not tell mobile users to "check for the sign-in email."
6. **Ban is not instant.** Because an already-issued JWT stays valid until expiry (~1h), a banned user can keep using the app until their token refreshes. Set expectations accordingly ("sign out to apply immediately").
