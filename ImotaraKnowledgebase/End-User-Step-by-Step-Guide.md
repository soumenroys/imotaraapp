# Imotara — End-User Step-by-Step Guide

*Follow-along procedures for support staff to read verbatim to users on a call. Every step is grounded in the shipped UI (web app at www.imotara.com and the Imotara mobile app). Where the two differ, both variants are given as **On web:** / **On mobile:**. Bold text is the exact on-screen label. This is the step-by-step companion to the "User Support FAQ" doc — use the FAQ for "why", use this for "which button".*

*Escalation / support email: **info@imotara.com** (marketing collateral also shows soumenroys@gmail.com).*

---

## 1. Getting started

### 1a. Use Imotara without an account
1. Open the app — on web go to **www.imotara.com**; on mobile open the Imotara app.
2. Tap **Chat** and start typing. Text chat, mood check-ins, History, Trends, Grow, and reflections all work with no sign-in — data is stored locally on the device.
3. Understand the limits of anonymous use: cross-device sync, cloud backup, and unlimited voice are **not** available, and read-aloud (TTS ~15/day) and voice transcription (~20/day) have small daily caps. Cloud-only generated features (Companion's Letter, Emotional/Growth Arc, Year in Review) need an account and a connection.
4. If cloud replies hit the Free daily limit (20/day), the app quietly switches to on-device replies — the conversation is not blocked.

### 1b. Create an account (Google / email magic link / Apple)
1. **On web:** go to **Settings** and scroll to the **Remote history sync** card, or use the sign-in entry in the top bar. Choose **Google**, **email magic link**, or **Sign in with Apple** (Apple appears on iOS). Sign-in completes through the `/auth/callback` page and returns you to the app.
2. **On mobile:** open **Settings**, expand the **Your plan** section, and tap **Sign in to restore your plan** (this uses Google sign-in). The session token is stored securely in the device keychain.
3. Confirm you are signed in: **On web** the **Remote history sync** card shows **Signed in as [your email]**. **On mobile** the **Your plan** card stops showing the sign-in prompt.
4. Note: signing in is what turns on cross-device sync and cloud backup and removes the anonymous voice caps.

### 1c. Sign in on a second device
1. On the second device, repeat 1b with the **same** account (same Google/email/Apple identity).
2. Your history and profile pull down automatically from the cloud (see procedure 9 for forcing a sync).
3. If you want to share history without a full account, use the optional **Link Key** instead (procedure 9c).

---

## 2. Set up your companion

The companion settings live in one place.
- **On web:** **Settings → Tone & Context Preferences** (tagged **optional** and **local-only**).
- **On mobile:** **Settings → Your companion** (tap the section header to expand it). You can also open it from Chat by swiping left-to-right if **Swipe right — Your Companion** is enabled.

Steps:
1. In the left card (**Personal info** on web), set your own **Name (optional)**, **Age range**, **Gender**, and **Preferred language**. These only shape wording; they are not shared.
2. Turn on the companion: **On web** flip the **Expected companion tone** switch to on ("Turn on to set preferred companion characteristics"). **On mobile** the companion fields are in the **Your companion** section.
3. Set **Companion name (optional)** — e.g. a placeholder like "A calm friend voice".
4. Set the companion's **Age range** and **Gender**. Gender is important because it drives the read-aloud voice (see procedure 5). Options: **Prefer not to say / Female / Male / Non-binary / Other**.
5. Set **Relationship vibe**: **Mentor, Elder, Friend, Coach, Sibling (younger/peer vibe), Junior buddy (younger vibe), Parent-like (tone only), Partner-like (tone only)**, or **Prefer not to specify**. This changes warmth and framing only — it is tone guidance, not identity simulation.
6. Set **Response style**: **Let Imotara decide, Comfort me — be present & warm, Help me reflect — ask gentle questions, Motivate me — be encouraging & energetic,** or **Give advice — practical next steps**. A one-line example of the chosen style appears beneath the picker. You can always override it in conversation.
7. **On web only:** tap **🔊 Preview voice** under the companion Gender to hear how the voice sounds.
8. **On web:** press **Save** (top-right of the card). **On mobile** changes save automatically and also sync to your account when signed in. To wipe all these settings, use **Reset** (web).

---

## 3. Chat basics

### 3a. Send a message
1. Open **Chat**.
2. Type in the message box at the bottom (**On web** placeholder area; **On mobile** the composer) and press Enter / the send arrow.
3. **On web:** start a fresh conversation with the **New conversation** button (top of the thread list); rename or delete threads from the thread list (**Rename**, **Delete thread**).

### 3b. Voice input (microphone)
1. Tap the **microphone** button in the composer. **On web** the tooltip reads **Speak your message** (or **Speak — will send automatically** in hands-free mode); while active it shows **Stop listening**.
2. The first time, allow microphone access when the browser/OS prompts. **On web**, if you blocked it you'll see **"Microphone access denied — allow it in your browser settings."**
3. Speak clearly. Recording auto-stops at your **Max recording duration** setting (procedure 5). Tap the mic again to stop early.
4. **On web**, common toasts: **"No microphone found. Please connect one and try again."**; **"No speech detected — try speaking closer to your microphone."**; and, if the language isn't supported for voice, **"Voice input isn't available in your current language. Try switching to English in Settings."**
5. If **Confirm before sending** is on (procedure 5), review/edit the transcript before it sends.

### 3c. Listen to a reply (read-aloud / TTS)
1. Hover or tap a companion message to reveal its action row.
2. Tap the **speaker** icon. **On web** the tooltip is **Read aloud**; while playing it becomes **Stop reading** (the icon changes to a muted speaker). **On mobile** the button reads **Listen** / **Preparing…** / **Stop** and its accessibility label is **Read message aloud** / **Stop speaking**.
3. To stop playback, tap the same button again (**Stop reading** on web, **Stop** on mobile).
4. To have every new reply read automatically, turn on **Auto-read assistant replies** (**Settings → Chat behaviour** on web), or use **Hands-free conversation** which speaks input → reply → read-aloud with no tapping.

### 3d. Emotion / sentiment chips
1. In **Settings**, enable **Sentiment seed chips** ("Show quick-tap mood hint chips above the message input"). **On web** this is under **Chat behaviour**.
2. In Chat, tap a chip above the composer to seed the message with a mood hint.
3. First-time users see intake chips such as **Overwhelmed, Anxious, Low, Okay, Good, Just exploring** under "How are you feeling right now?" — tap one to begin.

### 3e. Quick panels (mobile)
1. **On mobile → Settings → Quick panels**, enable **Swipe right — Your Companion** and/or **Swipe left — Plan & Support**.
2. In Chat, swipe left→right to open companion settings, or right→left to open plan & support.

### 3f. Breathing exercise
1. In the Chat composer, tap the **breathing** button. **On web** the label toggles **Open breathing exercise** / **Close breathing exercise**.
2. Pick a pattern. Patterns are **Box Breathing** (Inhale 4 / Hold 4 / Exhale 4 / Hold 4), **4-7-8 Calm** (Inhale 4 / Hold 7 / Exhale 8), and **Simple Breath** (Inhale 4 / Exhale 6).
3. **On mobile** you can also pick a background sound: **Silent, Bowl, Rain, Ocean**.
4. Set your default pattern in **Settings → Grow & Wellbeing → Default breathing pattern** (web) or the equivalent **Default breathing pattern** picker (mobile). Note: the breathing screen also opens automatically during crisis detection.

---

## 4. Change language / reply in another language

Language is decided in this priority order: an explicit in-chat switch request > your **Preferred language** setting > automatic script/Roman-text detection > English.

### 4a. Switch language for one message, mid-conversation
1. Just ask in the chat, e.g. "**reply in Hindi**", "**let's talk in Tamil**", "**switch to Spanish**", "**answer in Bengali**". Any intent verb (speak/talk/reply/write/respond/use/switch/change/try/chat/answer) plus a language name is recognized.
2. Supported switch targets include English, Hindi, Bengali/Bangla, Marathi, Tamil, Telugu, Gujarati, Kannada, Malayalam, Punjabi, Odia/Oriya, Arabic, Urdu, Russian, Chinese/Mandarin, Japanese, Spanish, French, German, Portuguese, Indonesian, Hebrew.

### 4b. Set a permanent preferred language
1. Go to the companion setup (procedure 2) and set **Preferred language**.
2. **On web** options include **Auto-detect**, English, the Indian-language group (Bengali, Gujarati, Hindi, Kannada, Malayalam, Marathi, Odia, Punjabi, Tamil, Telugu, Urdu), and Other Languages (Arabic, Chinese–Mandarin, French, German, Hebrew, Indonesian, Japanese, Portuguese, Russian, Spanish).
3. The preferred language wins over script detection — so if you set English but type in Hindi script, you still get English replies.

### 4c. What script detection does
- If you leave language on **Auto-detect** and type in a native script (or common Roman/"Hinglish" typing), Imotara detects the language from the script and replies in kind. Setting a preferred language overrides this; an explicit switch phrase overrides everything for that turn.
- Note: Odia is not supported by the voice transcription engine, so spoken Odia may mis-detect — typing is more reliable there.

---

## 5. Voice settings

### 5a. Choose the voice gender and preview it
1. The read-aloud voice follows your **companion Gender** (procedure 2). Male/Female pick gendered voices; Non-binary/Other/Prefer-not use a neutral voice. The regional accent follows your language.
2. Preview it: **On web** tap **🔊 Preview voice** in the companion Gender area. **On mobile** tap **🔊 Preview companion voice** (it becomes **⏹ Stop preview** while playing).

### 5b. Speed & pitch
1. **On web:** **Settings → Appearance → Voice playback speed & pitch** (a **Plus+** feature). Drag **Speed** (0.50–1.50×) and **Pitch** (0.50–1.50).
2. **On mobile:** **Settings** has **Voice speed** and **Voice pitch** controls (grouped as **Voice speed & pitch**).

### 5c. Recording / transcription options
1. **Max recording duration** — how long the mic records before auto-stopping (**Settings → Appearance → Max recording duration** on web; **Settings → Voice input → Max recording duration** on mobile).
2. **Recording quality** — **High** / **Low** (web).
3. **Cloud transcription** — toggle "Send audio to server for higher-accuracy speech recognition" (web).
4. **Confirm before sending** — review the transcript before it is sent (web).

### 5d. Fix "no voice available" on Android
1. If read-aloud is silent on Android you'll see the toast: **"Voice not available for this language on your device. Either install this language in your mobile or login into Imotara account from Settings"**.
2. Fix option A: install that language's text-to-speech voice in your phone's system settings (Android **Settings → System → Languages → Text-to-speech output → install voice data**).
3. Fix option B: sign in to your Imotara account (procedure 1b) so read-aloud can route through the cloud neural voice instead of the device voice.

---

## 6. Mood check-in, History, Trends, Reflect & Grow

### 6a. Mood check-in (Feel)
1. **On web:** open **/feel** (**Feel** in the top bar). The header reads **"How are you feeling?"**
2. Tap one of the mood tiles: **Joyful, Calm, Sad, Anxious, Stressed, Angry, Lonely, Surprised**.
3. Optionally add a note in "What's on your mind right now…" and tap **Log check-in**. A **🔥 streak** counter shows consecutive days, and recent check-ins appear under **Recent**.
4. Quick check-in is also embedded inside the **Grow** page.

### 6b. History — browse, search, filter, delete
1. Open **History** (**View Emotion History** link in Settings, or the History tab).
2. **Browse:** each entry is a moment from your conversations; open an entry to see detail or jump back to Chat.
3. **Search — On web:** tap **Search**, then type in **"Search by emotion or message…"**. **On mobile:** tap the search toggle and type; you can also pick an emotion filter (default **all**).
4. **Delete a single entry — On mobile:** swipe the row left to reveal the red **Delete** action and tap it. **On web:** manage entries from the History controls; bulk removal is under **Settings → Local data controls**.
5. **Retention note:** Free shows the last 7 days, Plus 90 days, Pro unlimited — a banner offers an upgrade when your plan caps history.

### 6c. Trends (mobile) / charts
1. Open the **Trends** tab (mobile). It shows a **streak card** ("[N] days in a row", flame icon at 7+, spark at 3+), a **reflection journal streak**, a **weekly mood recap**, weekly emotion-frequency bars, a **30-day mood line chart**, and a radar chart.
2. **Badges / tips:** a notification badge on Trends clears when you open the tab. Turn discovery tips on/off with **Settings → Feature tips** ("Show one feature tip per hour in the Trends tab").
3. **On web** the equivalent charts (emotion radar, 12-week mood heatmap) live on the **Grow** page; emotion insights (radar + heatmap) are a **Pro** feature shown as a preview on lower tiers.

### 6d. Reflect & Grow (prompts)
1. Open **Grow**. (The **/reflect** URL redirects here — there is no separate Reflect page.)
2. Read **Today's prompt** and write in "Write what comes to mind — there's no wrong answer…", then tap **Save reflection** (⌘/Ctrl+Enter also saves). Prompts personalise to your recent emotional arc; tap **↻ Try another** for a different one, or **Use general instead** to leave the personalised prompt.
3. Grow also holds the **30-Day Challenge**, the **Daily Journal** (with **Today's prompt**), **Themes I notice in your reflections**, and **Past reflections** (expand to **Edit** / **Delete** entries).

---

## 7. Companion Letter, Growth Arc, Year in Review, Future & Unsent Letters

### 7a. Companion's Letter
1. Letters are generated automatically on a cadence and delivered to you. Set how often: **Settings → Companion insights → Companion letter — every [7/14/30/60] days** (a **Pro+** feature; open the **Advanced** section on web).
2. Read past letters in **Settings → Companion insights → 💌 Letters from Imotara**. Expand a letter, then use **🔊 Listen** (becomes **⏹ Stop**), **React** (pick an emoji), or **Write reply / Edit reply** → **Save reply**.
3. **On mobile** letters also surface as a **Companion Letter card** with a **Listen** button.

### 7b. Growth / Emotional Arc
1. This is a narrative summary of your emotional journey, generated on a cadence. Set it in **Settings → Companion insights → Emotional arc — every [7/14/30/60] days** (**Pro+**).
2. A mini weekly arc (the last 7 days of emotions with "mostly [emotion]") appears at the top of the **Grow** page.

### 7c. Year in Review
1. Open **History**. The **Year in Review** card ("Your [year] emotional journey") generates automatically when you have enough history.
2. Tap **Read →** to expand the narrative; use **Copy** to copy it, or **Collapse** to close.

### 7d. Future Letter (letter to your future self)
1. Open **Grow** and find **Letter to future self**.
2. Tap **+ Write**, type your note ("Dear future me…"), choose an unlock delay (**7d / 30d / 90d / 180d / 1 yr**), and save — you'll see "Letter sealed — unlocks in [N] days ✓".
3. The letter stays locked until its unlock date, then appears in the unlocked list. Delete a letter from the same section.

### 7e. Unsent Letter (write to someone you can't send to)
1. **On mobile:** open the **Unsent Letter** modal (surfaced as a chat hint if **Unsent Letter hint** is enabled). Answer **"Who is this letter to?"**, add the relationship/context (e.g. "They passed away last year. We never got to say goodbye."), then continue.
2. Write your letter in Chat; Imotara replies in that recipient's voice. **On web** the chat shows "Writing to [name] — Imotara will respond in their voice"; tap the ✕ to exit that mode.

---

## 8. Companion memory (view / edit / delete)

1. Go to **Settings → Companion memory** (open the **Advanced** section on web).
2. **View:** each remembered fact shows its value plus its type, key, and a confidence %. If empty you'll see "No memories yet — Imotara will pick up facts as you chat."
3. **Refresh** the list with the **Refresh** button.
4. **Delete one fact:** tap **Forget** on that row (accessibility label "Forget this memory").
5. **Control capture:** turn **Companion memory auto-capture** on/off (**Settings → Chat behaviour** on web). Set the **Memory cap** (max number of facts retained) under **Companion memory**.

---

## 9. Sync across devices

### 9a. Turn on cloud sync / back up now
1. Sign in first (procedure 1b).
2. **On web:** **Settings → Remote history sync → Back up now** pushes local history to the cloud and pulls records from other devices. Status text appears below.
3. **On mobile:** sync runs automatically when signed in (unsynced items are batched and pushed after a short debounce, and again when the app returns to the foreground). Set **Analysis Mode** to **Auto** or **Online** (procedure 11) so cloud sync is allowed — **Local** keeps everything on-device and does not sync.

### 9b. Force a sync
1. **On web:** press **Back up now** (see 9a).
2. **On mobile:** bring the app to the foreground, or leave the chat open briefly — a sync fires on the debounce and on foreground.

### 9c. Link history across devices with a Link Key (chatLinkKey)
1. **On web:** **Settings → Sync with another device (optional)**. Type a private phrase (no spaces, ~8–20 chars) into "Paste a Link Key…" and press **Save** (or **Copy** to share it, **Clear** to remove).
2. **On mobile:** **Settings → Privacy & safety → Link this device (optional)**. Enter the **same** Link Key (e.g. "soumen-sync-1") and tap **Save** (**Clear** to remove).
3. Both devices with the same Link Key share the same remote chat-history bucket. Treat the key like a password.

### 9d. Sync status indicators
1. **On mobile:** turn on **Settings → Show sync status** ("Show reply source on messages") to see each message's source badge. The **Show sync status** and per-message origin badge tell you whether a reply came from cloud or local.
2. **On web:** the Chat top bar shows a sync chip and a conflicts button; the **History** legend explains: **green ●** = synced entries, **amber ●** = entries with conflicts you can review in the Conflicts panel.

---

## 10. Notifications

### 10a. Daily check-in reminder at a chosen time
1. **On web:** **Settings → Browser notifications → Enable notifications** (allow the browser prompt). Then set **Preferred reminder time** (a time picker) — "Daily check-in reminder fires around this time".
2. **On mobile:** **Settings → Daily check-in reminder** — flip the switch on (allow the OS permission), then set the time with the **Hour** and **Minute** steppers (minutes step by 15). Optionally enable **Play sound** and **Show badge**.

### 10b. Inactivity nudge
1. **On web:** in the same **Browser notifications** card, choose **Remind me if I haven't visited in**: **24 h / 48 h / 72 h / 7 days**.
2. **On mobile:** under the reminder, set **Nudge if silent for** to your chosen interval.

### 10c. Disable notifications
1. **On web:** **Settings → Browser notifications → Disable notifications**. (If the browser itself blocked them, you'll see "Notifications blocked by your browser. Allow them in your browser's site settings, then reload.")
2. **On mobile:** flip the **Daily check-in reminder** switch off.

---

## 11. Privacy controls

### 11a. Analysis mode (Auto / Cloud / Local)
1. **On mobile:** **Settings → Privacy & safety → Analysis Mode** — choose **Auto** (tries cloud, falls back to local), **Online** (always cloud), or **Local** (device-only, nothing sent externally). Online may require Premium; if locked you'll see "Online mode unavailable". This same mode is shared with Chat.
2. **On web:** the mode is displayed in **Settings → Emotion analysis mode** but is **changed from the Chat page** using the analysis toggle (Local only / Auto routing / Remote allowed). In **Auto**, local analysis runs first and data goes to the cloud only when local confidence is low.

### 11b. Export your data
1. **On web:** **Settings → Export data → Download JSON** (local chat history). A fuller export is on the **History** page via **Export JSON** (a **Pro** feature for the complete emotion history).
2. **On mobile:** **Settings → Privacy & safety** offers **Export JSON**, **Export CSV**, and **Export Journal** (each opens the system share sheet).

### 11c. Clear local data
1. **On web:** **Settings → Local data controls** → **Clear Chat conversations**, **Clear Emotion History**, or **Clear ALL local Imotara data**. You can also set **Auto-delete chat threads older than** here.
2. **On mobile:** **Settings → Clear Local History** (and **Clear Remote Data** to delete cloud records — requires sign-in).

### 11d. Delete cloud data / delete account entirely
1. **On web:** **Settings → Delete account**. Signed in, the button is **Delete my account** ("Permanently delete your Imotara account and all associated cloud data — conversations, memories, and settings. This cannot be undone."). Signed out, it is **Clear all local data**.
2. **On mobile:** use the delete-account control (calls the account-delete endpoint) after signing in, or **Clear Remote Data** to remove cloud history only. Data deletion is available on every tier, including Free.

---

## 12. Upgrade, purchases, and donations

### 12a. Buy a plan on the web (Razorpay)
1. Go to **/upgrade** (or **Settings → Your plan → View plans & upgrade →**).
2. Pick a plan: **Plus** (₹99/mo, `plus_monthly`) or **Pro** (₹149/mo, `pro_monthly` — "Everything in Plus, Unlimited history, Emotion trends & mood graphs, Companion letters, Growth arc tracking, Unlimited Connect history"). Press **Subscribe**.
3. Complete payment in the Razorpay checkout window. Your license activates after the payment verifies (the webhook may lag a few seconds — press **Refresh** on the **Your plan** card if it doesn't show immediately).

### 12b. Buy a plan on Android
1. **Settings → Your plan → Upgrade your plan** opens the upgrade sheet. Pick a plan and tap **Subscribe**. Android purchases are verified server-side against the purchase token.
2. If it doesn't activate, tap **Restore previous plan** (Android restores by signing in and re-fetching the license).

### 12c. Buy a plan on iOS (Apple In-App Purchase)
1. Open the upgrade sheet and tap **Subscribe** — payment goes through Apple StoreKit.
2. If activation is pending, or the plan is already on your Apple account, tap **Restore previous purchases** (required by App Store guidelines) to link it to your profile.

### 12d. Restore purchases
1. **iOS:** upgrade sheet → **Restore previous purchases**.
2. **Android:** upgrade sheet → **Restore previous plan**; or **Settings → Your plan → Already purchased? Tap to check your plan** (re-checks the license).

### 12e. Buy token packs (message credits)
1. **On web /upgrade:** under top-ups choose **₹49 → 100**, **₹99 → 250**, **₹199 → 600**, or **₹499 → 1800** message credits (never expire) — paid via Razorpay.
2. **On mobile:** the upgrade sheet has a **Top up with message credits** section (purchased via the store IAP).

### 12f. Cancel a subscription
1. **On web (Razorpay):** **Settings → Your plan → Cancel subscription** → **Confirm cancel**. You keep access until the end of the billing period, then revert to Free.
2. **On mobile:** **Settings → Your plan → Manage subscription** → **Manage in App Store →** (iOS) or **Manage in Google Play →** (Android). Store subscriptions can only be cancelled in the store, not server-side.

### 12g. Donate
1. **On web:** **Settings → Support Imotara (Donate)** — tap a preset amount; a Razorpay order opens; after a successful, webhook-verified payment the receipt appears under **Your Donations** (press **Refresh** to reload). The **/donate** page offers the same presets.
2. **On iOS:** donations/tips go through the Apple tip jar (consumable IAP) — tap a tip amount ("Processed securely by Apple"). Donations are separate from subscriptions.

---

## 13. Join an organization / see who manages your account

### 13a. Join an organization
1. **By invite:** your org admin adds you (often via bulk CSV invite); once added, your tier and any org branding apply automatically the next time your license refreshes.
2. **By email domain:** sign up/sign in with an eligible work/school email tied to the org (domain auto-join, for EDU/NGO orgs).
3. **Apply for an org plan yourself:** **On mobile → Settings → Your plan → Organisation plan → Apply for org plan →** (opens imotara.com/org/new). Peer-companion roles: **🌿 Join Imotara Movement → 🤝 As Wellness Companion →**.

### 13b. See who manages your account
1. **On web:** **Settings → Your plan** shows, when applicable, **🏢 Managed by [organization] · your role: [role]** (or a license-pool/override note).
2. **On mobile:** **Settings → Your plan** shows a **Managed by [organization]** badge with the org's billing-type icon and your role. Org members don't see upgrade prompts, and admins see only aggregated, anonymized analytics — never your individual conversations.

---

## 14. Settings search (mobile)

1. Open **Settings** on mobile. At the top is a search box: **"Search settings or describe what you need..."**
2. Type a keyword (e.g. "voice", "breathing", "delete") or a whole sentence — local matching is instant; for sentences (3+ words) it falls back to AI matching (a ✨ sparkle shows when AI was used).
3. Tap a result to jump straight to that setting's section. Tap the **✕** to clear. If nothing matches you'll see "No settings found for '[query]'".

---

## 15. Get help — report a problem, crash/bug report, contact support

### 15a. Report a problem or bug (mobile)
1. **Settings → Feedback / Report Issue**.
2. Choose **Feedback** or **Bug Report**. For a bug, describe "what happened, what you expected, steps to reproduce".
3. Tap **Open Email** — this opens your mail app pre-addressed to support with the subject "[Imotara] Bug Report" or "[Imotara] Feedback". Tap Send. If no mail app opens, email **info@imotara.com** directly.

### 15b. Help & guides (web)
1. **Settings → How to use Imotara** has quick cards (Just talk / Works everywhere / Make it yours / Your data, your control) plus **Full guide →** (/guide), **Privacy policy** (/privacy), and **Terms** (/terms).
2. **App info / version:** **On mobile → Settings → App Info** shows **Version** and **Build**.

### 15c. Contact support / escalate
1. Primary contact is **info@imotara.com**. For data-export/deletion requests a user can't complete in-app, or any safety-critical report, escalate by email.
2. Imotara is a private wellness companion for self-reflection — **not** a therapist or a replacement for professional care. If someone is in danger, direct them to the in-app crisis helplines or local emergency services.

---

*Prepared for Imotara support. Verified against the web app (src/app/settings, chat, feel, history, grow, upgrade, donate) and the mobile app (SettingsScreen, ChatScreen, HistoryScreen, TrendsScreen, and imotara components). Report any UI wording that no longer matches so this doc can be updated.*
