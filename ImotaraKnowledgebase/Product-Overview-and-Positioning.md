# Imotara — Product Overview & Positioning

*A plain-language reference for marketing, support, partnerships, and anyone who needs to understand what Imotara is and where it sits in the market. Sourced from the product repo (`docs/IMOTARA_OVERVIEW.md`, `docs/ARCHITECTURE.md`, `docs/LICENSING.md`) and the internal brand/marketing decks in `docs/`.*

## What Imotara is

Imotara is a private, emotion-aware AI companion that helps people understand their feelings, track their mood over time, and grow emotionally — **without ads, without paywalls during conversations, and without data tracking**. It is available as a web app (www.imotara.com), an iOS app, and an Android app.

The name "Imotara" is a coined word combining *emotion* and *-ara* (a suffix suggesting movement, arrival, presence). The site tagline positions it as **"An Immortal Friend for Your Emotions."**

Three things Imotara explicitly is **not**:
- **Not a therapy replacement.** It is a wellness companion for self-reflection and emotional awareness — designed to complement, not replace, professional mental health care.
- **Not a social app.** No feed, no likes, no followers, no public profiles, no public performance.
- **Not a generic chatbot.** It reflects a person's patterns back to them over time through history, timelines, and a companion that remembers.

## Mission and vision

**Vision (verbatim from the internal overview):** *"To make emotional support as accessible as a text message — in every language, for every person, with full privacy."*

The core beliefs driving every product decision:
- Emotional support should not be gated behind affordability.
- Privacy is not a premium feature — it is the baseline.
- The companion should feel personal, not generic.
- Users should never feel trapped or manipulated into paying.
- The app should work even when the user has no internet.

The "About" page tells the origin story: Imotara was conceived not in a boardroom but "in the quiet concern of two mothers" (Saswati and Parbati) who wanted a gentle, judgement-free space where feelings could be spoken safely.

## What makes Imotara different

1. **Privacy-first by design.** Local-first by default — conversations are stored on the user's own device, and cloud sync/analysis only happens with explicit consent. No ads, no data selling, no third-party tracking SDKs, no analytics on emotional content.
2. **Emotion-aware.** Every reply is shaped by the emotion detected in the message plus the user's emotional history. Two real palettes exist, not one: the on-device analyzer tracks **9 states** (joy, sadness, anger, fear, anxiety, disgust, surprise, gratitude, neutral), while the cloud AI palette tracks **15** (adds love, curiosity, confusion, shame, guilt, loneliness, hope — swaps out gratitude). Corrected 2026-07-19 from a stale "8 states" claim that matched neither real model.
3. **22 languages as a first-class feature**, including 11 Indian languages with gendered verb conjugation for Indic languages — a technical capability the internal competitor analysis says no rival has matched.
4. **Offline fallback.** On mobile, when there is no internet or the cloud quota is exhausted, an on-device engine keeps the companion present. It never hard-blocks the user.
5. **A real companion persona**, not a nameless bot — the user configures a name, gender, age, relationship vibe, and response style.
6. **Culturally rooted.** Indian mythology, regional wisdom quotes, and story engines give support in a culturally resonant frame.
7. **"Not a therapy replacement" disclaimer** is stated consistently across the product and marketing.

### Non-negotiable design rules (from the internal overview)
- Never hard-block — always fall back to a local reply when cloud quota is exhausted.
- Never gate local replies — local is always free.
- Never show a paywall during an active emotional conversation.
- Server-side enforcement only for quotas — client-side limits are never trusted.

## The companion persona system (in plain language)

Imotara's companion is something the user shapes to feel like whoever they need. In Settings, a user configures:

- **Companion name** — defaults to "Imotara," but can be anything.
- **Companion gender** — female, male, nonbinary, other, or prefer-not-to-say. This also determines the voice used for read-aloud.
- **Companion age range** — influences vocabulary and register.
- **Relationship vibe** — how the companion relates to the user. Options: **Friend, Mentor, Elder, Coach, Sibling, Junior buddy, Parent-like, Partner-like.**
- **Response style** — what kind of reply the user wants by default: **Comfort me, Help me reflect, Motivate me, Give advice,** or **Let Imotara decide.**

Separately, the app also adapts to the **user's own** age group (teen, young adult, adult, senior) and gender. Teenagers get extra-sensitive, careful messaging; elderly users get patient, unhurried copy. The same emotional content is expressed differently depending on who is reading it. These choices shape every reply — both cloud AI and offline local replies.

## Feature tour

**Core (both platforms):**
- **AI Chat** — emotion-aware replies, cloud with local fallback; on web, replies stream in word-by-word.
- **Feel / Mood check-in** — quick emotion selector with an intensity slider (8 emotion states, tracked over time).
- **History** — a calm emotion timeline with a summary card, pie chart, and emotion filter; export and delete controls.
- **Companion Memory** — the app automatically detects and stores meaningful user facts (name, job, relationships, events) to make replies feel remembered; the user can view, edit, and delete these.
- **Grow / Reflect** — daily reflection prompts and guided journaling that help the user notice patterns and celebrate small wins.
- **Trends** — mood charts (30-day line chart, weekly bar chart, emotion heatmap, emotion radar), a daily mood table, and a streak counter.
- **TTS playback** — AI replies read aloud in the companion's voice; **Voice input** — speak instead of type.
- **Dark mode**, **cross-device sync**, and **daily check-in reminders**.

**Emotional-intelligence features:**
- **Companion's Letter** — a monthly AI-written letter from the companion reflecting on the user's emotional journey (archived, browsable, can be read aloud and replied to).
- **Emotional Arc Narrative** and **Growth Arc** — monthly/long-term narrative summaries of emotional patterns.
- **Emotional Year in Review** — a December-only yearly reflection.
- **Emotional Open Loops** — detects unresolved emotional threads and gently revisits them later.
- **Emotional Milestone Celebrations**, **Conflict Detection** (gently surfaces contradictions with past statements), **On This Day** (surfaces a matching entry from a previous year), and a post-session **Tone Reflection Card.**
- **Unsent Letter / Shadow Voice** — a cathartic "letter you'll never send," and **Future Letters** — write to your future self; the letter locks and unlocks on a chosen date.

**Wellness and content:**
- **Guided Breathing** modal with ambient sounds (bowl, rain, ocean), triggered from chat.
- **Cultural content engines** — mythology, wisdom quotes, and micro-story generators, language- and culture-aware.
- **Blog** and mind-wellness guide content (marketing/SEO).
- **Donate** — a donation landing page with preset amounts, processed via Razorpay.

**Platform notes:** Streaming replies, multi-thread conversations, data export (JSON/CSV), and remote data deletion are richest on web; full offline AI, breathing modal, streak tracking, mood charts, and push notifications are mobile strengths.

## Supported languages (all 22) and platforms

The authoritative language set (from the TTS voice map and emotion keyword maps) is 22 languages:

**Indian languages (12):** English, Hindi, Bengali, Marathi, Tamil, Telugu, Gujarati, Punjabi, Kannada, Malayalam, Odia, Urdu.

**Global languages (10):** Spanish, French, German, Portuguese, Russian, Arabic, Chinese (Mandarin), Japanese, Hebrew, Indonesian.

Every language is supported across AI reply generation (cloud + local), Azure Neural TTS voices, emotion keyword detection, local reply banks, and native wisdom fragments.

> **Support note (resolved 2026-07-19):** Three surfaces — `layout.tsx` JSON-LD, the `ai-mental-wellness` FAQ, and `public/llms.txt` — used to list "Korean, Turkish, Italian" as examples, which don't match the actual supported set above. The home-page FAQ (`src/app/page.tsx`) was correct the whole time and was never the source of the bug. All three wrong locations now match the authoritative 22-language list.

**Platforms:** Web (Next.js on Vercel, PWA-capable), iOS (App Store — `id6756697569`), Android (Google Play — `com.imotara.imotara`). Both mobile apps share the same Vercel-hosted backend API.

## Target personas and market positioning (per internal decks)

The internal **Target Audience Personas** deck defines four primary user segments (attributed to internal marketing docs, June 2026):

1. **Urban Professional** — e.g. "Priya Sharma," 25–32, Tier-1 metro, therapy-curious but time- and budget-constrained; uses the app late at night. Resonant message: *"₹79/month. Less than one therapy copay. Available at 2 AM."*
2. **College Student** — e.g. "Arjun Mehta," 18–23, first time away from home, homesick, patchy hostel Wi-Fi; values the free tier and offline AI.
3. **Regional India** — e.g. "Sunita Devi," a Tier-2/3 Hindi-speaking teacher with no local mental-health services and intermittent internet; values full Hindi AI, voice input, and offline mode.
4. **Homemaker / Parent** — e.g. "Kavitha Nair," 33–50, carrying the "invisible load" of parenting, wanting a private space in her mother tongue (e.g. Malayalam).

**Positioning:** the decks frame Imotara as *"the only credible emotional wellness platform built for India, in Indian languages, at Indian prices, with Indian cultural context."* Core campaign message: *"Apni bhasha mein, apni sharti pe"* — "In your language, on your terms."

## Competitor landscape (per internal decks)

The internal **Competitor Landscape** and **Key Differentiators** decks profile six competitors and claim eight structural moats. Summary of the stated positioning (attributed to internal analysis):

| Competitor | Indian languages | Offline AI | Positioning gap Imotara claims |
|---|---|---|---|
| **Wysa** (AI CBT, B2B) | 0 (English only) | No | Clinical/cold vs Imotara's warm companion + 11 Indian languages |
| **YourDOST** (human counsellors) | 1 | No | ₹499/session + scheduling friction vs 24/7 AI |
| **InnerHour** (guided programs) | 0 | No | Rigid programs vs conversational AI |
| **Replika** (global AI companion) | 0 | No | No wellness tools, US data storage vs privacy-first local |
| **Woebot** (CBT chatbot) | 0 | No | Scripted CBT vs warmth + 71 tools |
| **Headspace / Calm** (meditation) | 0 | No | Not conversational, USD pricing |

The eight claimed differentiators: the language moat (11 Indian languages + gendered AI grammar), privacy by design, offline-capable AI, accessible pricing, 71 evidence-backed psychological frameworks (CBT, DBT, ACT, narrative, somatic), the monthly companion letter, the customizable companion persona, and culturally rooted content.

## The B2B story

**Organization licensing (NGO / EDU / Govt / Commercial).** Imotara offers institutional deployment through Family, EDU, and Enterprise tiers plus dedicated NGO/reseller licensing. Organizations get an admin dashboard (`/org/dashboard` on web) for member management, bulk CSV/SCIM user provisioning, org-level and anonymized aggregate analytics, audit logs, custom institution branding, API keys, SSO/SAML, and data-residency controls. EDU adds classroom/cohort mode and LMS (Moodle/Canvas) integration; Enterprise adds API access, custom integrations, and team/department management. NGOs get beneficiary-wellbeing tooling and admin guides. Members see a "Managed by [organization]" badge, and org licensing was rolled out across web and mobile in Phases 1–5 (v1.1.10). *(Note: some org features — LMS embed, referral commission tracking — are "Coming soon" per the v1.2.7 changelog; see the Org How-Tos doc for the honest status of each.)*

**Imotara Connect marketplace (planned MVP v1.2).** Connect adds a real-human consultancy layer on top of the AI companion: users browse verified wellness companions, top up a prepaid per-minute wallet, and chat in real time (with real-time message translation between languages). The MVP covers text chat with a Mental Wellness Companion role; later phases add audio/video, up to 12 non-clinical companion roles (Friend, Mom/Dad, Sister/Brother, Grandparent, Yoga Instructor, etc.), and scheduled bookings. Revenue model: the user's recharge is split — Imotara keeps 20% at recharge time and the consultant earns 80%, billed per minute (`minutes_credited = (amount × 0.80) / rate_per_min`). Safety non-negotiables: a non-clinical disclaimer on every profile, an under-18 hard block, an emergency/crisis button in every session pointing to regional hotlines, and a Code of Conduct agreement at registration.

## Key URLs and brand voice

**Site pages (imotara.com):** `/chat`, `/history`, `/feel`, `/grow`, `/reflect`, `/settings`, `/profile`, `/donate`, `/about`, `/privacy`, `/terms`, and `/connect`. App store links: Google Play (`com.imotara.imotara`) and Apple App Store (`id6756697569`). Contact: **soumenroys@gmail.com / info@imotara.com**.

**Brand voice (from the internal Brand Voice Guidelines).** One voice: *"Warm, honest, Indian."* Five core personality traits: **Warm, Honest, Curious, Grounded, Indian.** Golden rule: *"Imagine your most empathetic friend — one who listens, never lectures, never panics, and remembers what matters to you."* Always: validate feelings before offering tools, ask one good question at a time, keep sentences short (<20 words), match the user's energy, and end on presence rather than a task. Never: use clinical/diagnostic language ("depression," "symptoms"), say "I understand how you feel" (say "That sounds really hard" instead), prescribe ("You should…"), push a feature mid-crisis, or lead with "As an AI." In crisis, stay grounded and gently surface a helpline "with care, not alarm."
