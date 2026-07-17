# Troubleshooting

Quick fixes for the most common hiccups: sign-in, syncing, voice, language, notifications, crashes, and more.

## "I can't sign in"

**On Android with Google sign-in — "it flashed and did nothing":**
1. This is usually a success in disguise. On Android, sign-in completes a beat after the browser window closes.
2. **Wait about 5 seconds**, or close and reopen the app — you'll very likely find yourself signed in.
3. If you cancelled or closed the sign-in window early, just try again.

**Waiting for a magic-link email on mobile:**
- The email magic link is a **web-only** sign-in option. On mobile, use **Google** (or **Apple** on iOS) instead — there's no sign-in email to wait for.

**Magic link not arriving (web):**
1. Double-check the email address you typed.
2. Check your spam folder.
3. Request a fresh link — links are single-use and time-limited.

**Apple sign-in closed unexpectedly:**
- If you dismissed the Apple sheet, that's just a cancel — tap sign in again.

**"You've been signed out" appears out of nowhere:**
- Sign in again. If you can't get back in and believe something's wrong with your account, email **info@imotara.com** and we'll look into it.

**Sign-in fails on a very old app version:**
- Update the app from the App Store / Play Store — older versions eventually stop being supported.

## "My chats aren't syncing between devices"

Work through these in order:

1. **Check your Analysis Mode isn't set to Local.** Local mode keeps everything on-device and intentionally never syncs — that's its whole point. Switch to **Auto** or **Online** (**Settings → Privacy & safety → Analysis Mode** on mobile; the analysis toggle on the Chat page on web) if you want cross-device sync.
2. **Make sure both devices are signed in to the same account** — same Google/email/Apple identity. A guest device has nothing to sync to.
3. **If you use a Link Key, it must be identical on both devices** (**Settings → Sync with another device** on web; **Settings → Privacy & safety → Link this device** on mobile).
4. **Force a sync:** on web press **Back up now** (**Settings → Remote history sync**); on mobile, bring the app to the foreground and give it a moment.
5. Check the sync status line in Settings — it tells you whether the last sync succeeded.

## "AI replies feel generic / the AI stopped replying properly"

If replies suddenly feel shorter and more templated, you've most likely reached the free daily limit:

1. Free accounts get **20 cloud AI replies per day** (resets at midnight UTC). After that, Imotara switches to its simpler on-device replies rather than blocking you — that's the "generic" feel.
2. Your options: **wait for the daily reset**, buy a **token pack** (credits carry you past the daily 20 and never expire), or **upgrade** to an unlimited plan. See Plans & Payments.
3. If you have credits or a paid plan and replies still feel off, check you're **signed in** (limits apply per account) and online, then restart the app. Still odd? Email **info@imotara.com**.

## "Voice / read-aloud is silent"

1. **Are you online?** Voice features need an internet connection.
2. **Are you signed out?** Guests get about 15 read-alouds per day — sign in for unlimited voice.
3. **On Android**, if you see "Voice not available for this language on your device": either install that language's text-to-speech voice in your phone's settings (**Settings → System → Languages → Text-to-speech output → install voice data** — on some phones, switching the speech engine to Google's helps), or simply **sign in to Imotara** so read-aloud uses cloud voices.
4. **Wrong gender or accent?** The voice follows your **companion Gender** and language settings — adjust them in Settings and use **Preview voice** to check.

## "It replies in the wrong language"

1. **Ask explicitly in chat** — "reply in Gujarati", "switch to Tamil". An explicit request always wins.
2. **Set your Preferred language** in the companion settings so it sticks.
3. If you type romanized text (e.g. Hinglish or romanized Gujarati), detection occasionally guesses wrong — typing a few words in the **native script**, or setting the preferred language, fixes it immediately.
4. A mostly-English message gets an English reply by design — one stray English word won't flip your language, but a fully English sentence will.

## "Notifications aren't arriving"

1. **Check the permission.** On mobile, the daily check-in reminder needs notification permission — flip the switch in **Settings → Daily check-in reminder** and allow the prompt. On web, use **Settings → Browser notifications → Enable notifications** and allow the browser prompt (if the browser itself blocked them, allow notifications in the browser's site settings and reload).
2. **Check the time you set** for the daily reminder.
3. **Using the app regularly? Then no nudges is normal.** The inactivity nudge only fires after you've been away (for example 48 hours of silence) — active users intentionally don't get nudged. That's a feature, not a fault.
4. Web push and mobile reminders are independent — enable each one where you want it.

## "The app crashed"

1. If you see the "Something went wrong" screen, tap **Restart app** — your data is safe, and most one-off glitches clear immediately.
2. If it happens again, tap **Send crash report** — it opens an email to **info@imotara.com** pre-filled with the technical details we need. Please send it and add a line about what you were doing; it genuinely helps.
3. Make sure you're on the latest app version from the App Store / Play Store.

## "I paid but nothing happened"

1. Wait a few seconds and refresh your plan (**Settings → Your plan → Refresh** on web; reopen the upgrade sheet on mobile).
2. On mobile, tap **Restore previous purchases** (iOS) / **Restore previous plan** (Android).
3. Still stuck after a few minutes? Email **info@imotara.com** with your payment reference. Full details in the Plans & Payments article.

## "My account / data disappeared"

The most common cause: the data lived under a **guest (signed-out) session**.

1. Guest data is stored only on the device — it does **not** survive reinstalling the app or clearing browser storage, and it can't be recovered afterwards (we never had a copy — that's the privacy model).
2. If you *were* signed in, your cloud data is safe: sign back in with the same account and it syncs down.
3. If data exists but isn't showing on one device, it's usually a sync setting — see "My chats aren't syncing" above.
4. Going forward: **sign in** so your history is backed up and follows you across devices.

## Still stuck?

Write to **info@imotara.com** with:
- What you were trying to do and what happened instead.
- Your platform (web / iOS / Android) and app version (**Settings → App Info** on mobile).
- Screenshots if you have them.

We'll get you sorted.
