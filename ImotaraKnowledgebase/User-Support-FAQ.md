# Imotara — User Support FAQ & Common Procedures

*Q&A reference for support staff answering end users. Answers are grounded in the product code and docs. Escalation contact: **info@imotara.com / soumenroys@gmail.com**.*

## Accounts & sign-in

**Q: How do I create an account?**
**A:** You can sign in with **Google**, an **email magic link**, or **Sign in with Apple** (iOS). On web, OAuth completes through `/auth/callback`; on mobile, the session (JWT) is stored securely in the device keychain. Signing in is what enables cross-device sync and cloud backup.

**Q: Do I have to sign in to use Imotara?**
**A:** No. You can use Imotara **anonymously** — chat, mood tracking, and history all work with data stored locally on your device. Anonymous users are given a device-local identity so the app still functions; some cloud extras (unlimited TTS, cross-device sync) require a real account, and anonymous voice/TTS have small daily caps (see Quotas).

**Q: How do I delete my account, and what gets deleted?**
**A:** Use the data-management controls in Settings (web has a full account wipe via `/api/delete-remote` and `/api/account/delete`). Deleting removes your cloud-stored data — chat messages, emotion/history records, user memories, and related rows — from Imotara's Supabase database (all user tables use row-level security, so only your rows are affected). Locally stored data is cleared by clearing the app's local storage / reinstalling. Data deletion is available on **every tier**, including Free.

**Q: How do I export my data?**
**A:** On web, use **Export** (`/api/export`) to download everything as **JSON or CSV**. A GDPR-style data request (a machine-readable package of all data held about your account) is available on all tiers. Data export as a downloadable file is a Plus-and-above feature in the licensing matrix, but the GDPR data-request path is available to everyone.

## Sync & offline

**Q: How does cross-device sync work?**
**A:** When you're signed in, your history and profile sync through the backend to Supabase and appear on your other devices. Mobile batches unsynced items and pushes them after a short debounce (default ~8 seconds), and re-syncs when the app returns to the foreground. Each message carries a "synced" flag so nothing is lost.

**Q: How do I link chat history across devices?**
**A:** Signing in with the same account links your history automatically. There is also an optional, user-controlled **cross-device sync key** (chat-link key) that scopes a shared history bucket across devices.

**Q: What happens offline?**
**A:** On mobile, Imotara keeps working — an on-device reply engine answers you in all 22 languages when there's no internet, and you can read previously loaded history. Voice input, read-aloud (TTS), and full cloud AI need a connection; the offline engine covers text replies only, and cloud-only features (Companion's Letter, Emotional Arc, Year in Review) won't generate offline. The web app is PWA-capable for offline use.

## Privacy

**Q: What data does Imotara store, and where?**
**A:** By default your conversations are stored **locally on your device**. If you're signed in and sync is on, data is stored in **Supabase (PostgreSQL)** with row-level security so you can only ever access your own rows. Cloud data is encrypted in transit (TLS) and at rest.

**Q: What does Imotara NOT collect?**
**A:** No ads, no third-party tracking SDKs, no analytics on your emotional content, and no selling of your data. No public profiles or social feed. Your message content is only sent to the cloud AI if you've enabled cloud/consented analysis, and no personal identifiers are injected into AI prompts (only emotion labels and anonymized facts).

**Q: What's the GDPR/privacy posture?**
**A:** An internal source-code audit (June 2026) scored Imotara **61/100** and confirmed a solid privacy-first architecture — local-first design, encryption, Supabase RLS, account deletion, and data export all exist. It flagged gaps being worked on (cookie consent, explicit terms acceptance at signup, a children's age gate, and defined data-retention periods). Apple App Store privacy was rated compliant (no tracking). If a user raises a formal data request or complaint, escalate to info@imotara.com.

## Payments, upgrades & donations

**Q: Is Imotara free right now?**
**A:** Yes — during the current launch period the app runs with licensing enforcement off, so **all features are unlocked for everyone**, and users who installed during the offer window received a free premium trial (default 90 days). The home page shows a "Launch offer — full access is free right now" banner. The Free-tier server quota (20 cloud replies/day) still applies to free accounts.

**Q: How do I upgrade?**
**A:** Through the in-app upgrade sheet. Paid tiers are **Plus, Pro, Family, EDU, and Enterprise**. Payments go through **Razorpay** (web + Android) and **Apple In-App Purchase** (iOS). One-time **token packs** (₹49→100, ₹99→250, ₹199→600, ₹499→1,800 messages; never expire) extend capacity beyond the daily quota. **Plus is ₹99/mo live in-app** (`upgrade/page.tsx`, tutorial page, and all `/help` docs agree) — some marketing collateral still advertises a stale ₹79/mo figure and needs correcting separately; quote ₹99 as the real price.

**Q: I paid but I don't have my license / plan. What do I check?**
**A:** See the "Licensing, Tiers & Payments" doc for the full flow. In short: for Razorpay, verify the payment completed and the verify-payment call succeeded (webhook may lag); for Apple, use **Restore Purchases** in the app (it re-verifies with Apple); for Google Play, the verify endpoint re-checks the purchase token. If the license row still isn't present, an admin can grant it manually and investigate the payment record.

**Q: How do I cancel my subscription?**
**A:** Via the subscription-cancel flow in Settings (`/api/subscription/cancel`) for Razorpay subscriptions; Apple/Google subscriptions are cancelled in the App Store / Play Store subscription settings (Imotara cannot cancel store subscriptions server-side).

**Q: How do donations work?**
**A:** The `/donate` page offers preset amounts processed via Razorpay. You pick an amount, a Razorpay order is created, and after a successful payment (verified by webhook) the donation is recorded and a receipt appears in Settings → Recent donations. Donations are separate from subscriptions.

## Quotas & daily limits

**Q: Why did I hit a daily limit?**
**A:** Free accounts get **20 cloud AI replies per calendar day** (resets at midnight UTC), enforced on the server. When you reach it, Imotara doesn't lock you out — it quietly switches to the offline/local reply so the conversation continues. To keep using cloud replies, buy a token pack or upgrade to an unlimited tier.

**Q: Are the limits different when signed out?**
**A:** Yes. Anonymous users have small daily caps on the cloud voice features (read-aloud TTS **15/day**, voice transcription **20/day**) because anonymous identities are cheap to create. Signing in removes those caps. Text chat still falls back to local replies rather than blocking.

## Voice & TTS issues

**Q: The voice/read-aloud isn't working.**
**A:** Check: (1) you're online — TTS needs a connection; (2) you haven't hit the anonymous 15/day voice cap (sign in for unlimited); (3) on web, the browser may be using its own built-in voice — Imotara uses Azure Neural TTS when the browser lacks a native voice for that language. If Azure is unreachable, mobile falls back to the device's built-in voice; on some devices (notably Samsung) the device may have no installed voice for the language — the app shows a toast suggesting the fix (install the language's TTS voice in device settings).

**Q: The voice sounds like the wrong gender or a wrong accent.**
**A:** Voice follows your **companion gender** setting (male/female; nonbinary/other/prefer-not use a neutral voice) and your selected language's regional voice. Set the companion gender and language in Settings. (Native device TTS ignores gender, which is exactly why Imotara routes chat read-aloud through Azure — including English on mobile.)

**Q: Voice input didn't transcribe my speech.**
**A:** Voice input uses OpenAI Whisper and needs internet. Speak clearly; recordings are capped at ~60s / 10 MB. Note that **Odia is not supported by Whisper**, so Odia speech may auto-detect as another language — typing is more reliable there.

## Notifications

**Q: How do check-in reminders work?**
**A:** You can enable a **daily check-in reminder** at a time you choose (mobile uses local push via Expo Notifications; web uses Web Push + a service worker). Mobile also sends an **inactivity nudge** after ~48 hours of silence. Custom notification schedules and weekly insight digests are higher-tier features. All notification types can be toggled in Settings.

## Organization members

**Q: What does "Managed by [organization]" mean?**
**A:** It means your account is part of an organization's Imotara license (a company, school, NGO, or government body — the badge shows 🏢/🎓/🤝/🏛️ accordingly). The org's admin manages your tier and may see **aggregated, anonymized** usage/wellbeing analytics — not your individual conversation content. Individual chats remain private to you.

**Q: How do I join my organization?**
**A:** Either through an **invite** (your admin adds you, often via bulk CSV invite) or by signing up with an eligible **email domain** tied to the org (domain auto-join, available for EDU and NGO orgs). Once linked, your tier and any org branding apply automatically, and the "Managed by" badge appears. Org members don't see upgrade prompts.

## Crisis situations

**Q: What does the app do if someone is in crisis?**
**A:** Imotara has 3-tier crisis detection. If it detects language suggesting immediate danger (suicidal ideation, recognized across 13 languages), it responds with grounded, warm support, opens a **guided breathing** exercise, and surfaces **crisis helplines for the user's country** (e.g., in India: Tele-MANAS 14416, KIRAN 1800-599-0019, Emergency 112; in the US: 988). For distress signals (hopelessness, feeling trapped), it gently surfaces in-app resources without interrupting. The tone is steady and non-alarming — never panic words, never a diagnosis.

**Q: Is Imotara a therapist or a replacement for therapy?**
**A:** No — and support should always be clear on this. Imotara is a **private wellness companion for self-reflection and emotional awareness, not a medical or therapeutic service.** It's designed to complement, not replace, professional mental health care. If someone is in danger or needs clinical help, direct them to the crisis helplines the app surfaces or local emergency services. The Imotara Connect human companions are also **non-clinical** roles, not licensed therapy, with an under-18 hard block and an in-session emergency button.

## Contact & escalation

**Q: How do users get help or escalate an issue?**
**A:** Primary contact is **info@imotara.com** (and **soumenroys@gmail.com** on marketing collateral). Community/docs support is available on all tiers; email support and a priority queue are Plus-and-above; EDU/Enterprise orgs get a dedicated account manager, an SLA, and guided onboarding. For data-privacy requests (export or deletion) that a user can't complete in-app, or any safety-critical report, escalate by email.
