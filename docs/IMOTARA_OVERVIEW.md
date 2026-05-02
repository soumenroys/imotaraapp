# Imotara — Complete Project Overview

> Last updated: 2026-05-03
> Author: Soumen Roy
> Platforms: Web (Next.js / Vercel) · iOS · Android

---

## 1. What is Imotara?

Imotara is a private, emotion-aware AI companion designed to help people understand their feelings, track their mood over time, and grow emotionally — without ads, paywalls during conversations, or data tracking.

It is not a therapy replacement. It is not a social app. It is a calm, private space where a person can talk honestly about how they are feeling and receive thoughtful, emotionally attuned responses — in their own language, at any time of day, even without an internet connection.

The name "Imotara" is a coined word combining *emotion* and *ara* (a suffix suggesting movement, arrival, presence). The companion has a name, a personality, and a relationship vibe chosen by the user — it can feel like a friend, a mentor, a sibling, or a calm elder, depending on what the user needs.

---

## 2. Vision

**To make emotional support as accessible as a text message — in every language, for every person, with full privacy.**

The core belief driving every product decision:

- Emotional support should not be gated behind affordability
- Privacy is not a premium feature — it is the baseline
- The companion should feel personal, not generic
- Users should never feel trapped or manipulated into paying
- The app should work even when the user has no internet

---

## 3. Design Philosophy

### 3.1 Never Hard-Block
When a user exhausts their free cloud quota, Imotara falls back to a local (on-device) reply rather than showing a hard paywall. The companion stays present. A gentle nudge appears between turns — never during an active emotional conversation.

### 3.2 Privacy First
No public profiles. No social feed. No data sold to advertisers. Emotion data stays on device by default. Cloud sync is opt-in and encrypted in transit.

### 3.3 Language is Identity
22 languages are supported not as an afterthought but as a first-class feature. The AI detects language switches mid-conversation. Gendered verb conjugation is handled for Indic languages (Hindi, Bengali, Marathi, Gujarati, Punjabi). The companion's personality adapts to the selected language's cultural context.

### 3.4 Age-Adaptive Communication
The companion changes tone based on the user's age group. Teenagers receive extra-sensitive, careful messaging. Elderly users receive patient, unhurried copy. The same emotional content is expressed differently depending on who is reading it.

### 3.5 Companion Persona
The companion is not a nameless chatbot. The user configures:
- Companion name (defaults to "Imotara")
- Companion gender, age range
- Relationship vibe (Friend / Mentor / Elder / Coach / Sibling / Junior buddy / Parent-like / Partner-like)
- Response style (Comfort me / Help me reflect / Motivate me / Give advice / Let Imotara decide)

These choices shape every reply — both cloud AI and offline local replies.

---

## 4. Platform Architecture

### 4.1 Web App (`imotaraapp`)
- **Framework:** Next.js 16 (App Router, React 19)
- **Hosting:** Vercel (serverless functions + CDN)
- **Auth:** NextAuth v4 + Supabase adapter (Google OAuth + email magic link + Apple Sign-In)
- **Database:** Supabase (PostgreSQL) with Row-Level Security on all user tables
- **AI:** OpenAI GPT-4.1-mini via `/api/respond` and `/api/chat-reply` (streaming SSE)
- **TTS:** Azure Neural TTS via `/api/tts` + 42 pre-generated preview MP3s on CDN
- **STT:** OpenAI Whisper via `/api/voice/transcribe`
- **Payments:** Razorpay (India + international) + Stripe fallback

### 4.2 Mobile App (`imotara-mobile`)
- **Framework:** Expo (React Native, New Architecture enabled)
- **Build system:** EAS Build (cloud builds) + EAS Submit (auto-submit to stores)
- **Auth:** Supabase JS client + expo-secure-store for JWT persistence
- **Local storage:** AsyncStorage (settings, history, preferences); companionMemory in expo-secure-store
- **AI:** Cloud via same Vercel API; offline via on-device local reply engine (pattern matching, 22 languages)
- **TTS:** Always Azure Neural TTS for chat replies (to honour companion gender); expo-speech fallback if API unreachable
- **Payments:** Razorpay (Android) + Apple IAP (iOS)
- **Push notifications:** Expo Notifications (FCM + APNs)

### 4.3 Data Flow
```
User message
  ↓
Mobile: SettingsContext reads tier + quota → decides cloud or local
  ↓
Cloud path:  POST /api/chat-reply → quota check → GPT-4.1-mini → stream reply → deduct token if free
Local path:  localReplyEngine.ts → emotion detect → template bank → Three-Part response
  ↓
Reply rendered → companion memory updated → emotion stored → history persisted
```

---

## 5. AI Architecture

### 5.1 Cloud Reply (GPT-4.1-mini)
Every cloud request assembles a rich context payload:
- System prompt with companion persona (name, relationship, response style, gender, age)
- User profile (age range, gender, language)
- Companion memory (up to 6 most recent user facts)
- Emotional history summary (dominant emotions over last 30 sessions, intensity trend)
- Rolling context breadcrumb (recent turns from current conversation)
- Cross-thread memory (topics from past conversation threads)
- Current emotion + intensity (detected from user's message)

The AI is guided to respond in the user's detected language, with culturally appropriate emotional register.

### 5.2 Local Reply Engine (Offline)
When cloud is unavailable or quota is exhausted, the on-device engine generates replies using a Three-Part Framework:

1. **Reaction opener** — tone-matched, language-specific opener (e.g., "I hear you." vs "মনে হচ্ছে...")
2. **Core emotional template** — emotion + tone + language bank selection
3. **Bridge** — closing question or statement to continue the conversation

The engine uses:
- Regex emotion detection against `keywordMaps.ts` (21 languages)
- Deduplication via `pickAvoidingRecent()` (skips replies with >50% overlap vs last 3)
- Native wisdom fragments (`nativeWisdomEngine.ts`) — 320 culturally rooted quotes across 20 languages
- Situational bridge (fires at turn ≥ 6 to acknowledge conversation depth)
- Romanised language detection (2-hit threshold, script mirroring at >65% Latin)

### 5.3 Emotion Detection
8 emotion states: joy, sadness, anger, fear, anxiety, loneliness, gratitude, neutral.
Detection is keyword-based on device; cloud AI detects with higher accuracy and returns an `emotion` + `intensity` (0–1) field used for history tracking and adaptive responses.

### 5.4 Language Detection
22 languages detected from message content. The engine:
- Checks Unicode script ranges (Devanagari, Bengali, Tamil, etc.) for Indic languages
- Uses keyword frequency for Latin-script languages
- Falls back to `preferredLang` from settings for short/ambiguous messages

---

## 6. Feature Catalogue

### 6.1 Core (Both Platforms)
| Feature | Description |
|---------|-------------|
| AI chat | Emotion-aware replies, cloud + local fallback |
| Mood check-in | 8 emotion states, tracked over time |
| Chat history | Threaded conversations with timestamps |
| Companion memory | Detects and stores user facts (name, job, relationships, events) injected into every AI call |
| Cross-device sync | `/api/profile/sync` — settings + history sync across devices |
| Daily check-in | Reminder to log mood daily |
| 22-language support | Full reply generation in all 22 languages |
| TTS playback | Azure Neural TTS for AI replies, honouring gender setting |
| Voice input | Mic → OpenAI Whisper transcription → chat send |
| Dark mode | Full dark theme on both platforms |
| Companion persona | Name, gender, relationship, response style |

### 6.2 Emotional Intelligence Features
| Feature | Description |
|---------|-------------|
| Emotional Open Loops | Detects unresolved emotional threads and revisits them in future sessions |
| Companion's Letter | Monthly AI-written letter from the companion reflecting on the user's emotional journey |
| Unsent Letter / Shadow Voice | User writes a letter they'll never send — cathartic release tool |
| Emotional Arc Narrative | Monthly narrative summary of emotional patterns |
| Emotional Year in Review | December-only yearly reflection across all stored emotions |
| Emotional Milestone Celebrations | Marks positive turning points (e.g., "You've talked about hope 10 times this month") |
| Conflict Detection | Detects contradictions between current and past statements, raises gently |
| On This Day | Surfaces a matching journal entry from the same date in a previous year |
| Tone Reflection Card | Post-session emotion summary card |

### 6.3 Web-Only Features
| Feature | Description |
|---------|-------------|
| Streaming replies | SSE token-by-token streaming (real-time feel) |
| Multi-thread conversations | Create, rename, delete conversation threads |
| Emotion timeline | Visual emotion history with filter bar |
| Data export | Download all data as JSON or CSV |
| Remote data deletion | Full account wipe from UI |
| Reply origin badge | Shows "cloud" vs "local" on each reply |
| Grow page | Future letters, growth reflection modules |
| Reflect page | Guided journaling prompts |
| Anonymous Collective Pulse | Aggregated anonymised mood signal across all users |
| Social Proof Benchmarking | Shows how user's emotional patterns compare to others |
| Admin panel (`/admin`) | License management, token top-up, audit trail — operator-only |

### 6.4 Mobile-Only Features
| Feature | Description |
|---------|-------------|
| Offline AI | Full local reply engine — works with no internet |
| Breathing modal | Guided breathing exercise triggered from chat, with ambient sounds (bowl, rain, ocean) |
| Streak tracking | Daily usage streak with visual indicator |
| Mood charts | 30-day line chart + 12-week emotion heatmap + 6-axis emotion radar chart |
| Future Letters | Write to future self; letter locks and unlocks on a chosen date |
| Cultural content engines | Mythology engine, wisdom quotes, story generators — language and culture-aware |
| Inactivity nudge | Push notification after 48h of silence |
| Companion memory UI | View, edit, delete remembered facts |
| Analysis mode toggle | Auto / Cloud / Local — user-selectable |
| Avatar | Age-based static image (professional look; matches user's age range and gender) |
| First-chat intake arc | 3-question onboarding before the first AI reply |

---

## 7. Language Support

**22 languages total:**

| Region | Languages |
|--------|-----------|
| Indian (12) | English, Hindi, Bengali, Marathi, Tamil, Telugu, Gujarati, Punjabi, Kannada, Malayalam, Odia, Urdu |
| Global (10) | Spanish, French, German, Portuguese, Russian, Arabic, Chinese (Mandarin), Japanese, Hebrew, Indonesian |

Language support covers:
- AI reply generation (cloud + local)
- TTS voice synthesis (Azure Neural TTS with gender-matched voices)
- TTS preview files (42 pre-generated MP3s on CDN — 22 languages × male/female)
- Emotion keyword detection
- Local reply template banks
- Native wisdom fragments
- Gendered verb conjugation (Indic languages)
- Romanised detection for users who type in Latin script

---

## 8. Licensing & Business Model

### 8.1 Tier Structure
| Tier | Price | Cloud Messages | History | Notes |
|------|-------|----------------|---------|-------|
| Free | ₹0 | 20/day (midnight reset) | 7 days | Local always free |
| Plus | ₹79/mo or ₹699/yr | Unlimited | 90 days | iOS: ₹99/mo |
| Pro | ₹149/mo or ₹1,199/yr | Unlimited | Unlimited | iOS: ₹1,299/yr |
| Token Pack | One-time | +100 to +1800 credits | — | Never expire |

### 8.2 Token Pack Pricing
- ₹49 → 100 messages
- ₹99 → 250 messages
- ₹199 → 600 messages
- ₹499 → 1,800 messages

### 8.3 Launch Offer
All users who install before 2026-07-01 receive Plus free for 90 days.

### 8.4 Payment Stack
- **Android + Web:** Razorpay (HMAC-SHA256 verified webhook, server-side upgrade)
- **iOS:** Apple In-App Purchase (transactionId deduplication, server-side verification before tier grant)
- **Enforcement:** Server-side only. Client never enforces quota — always verified at `/api/chat-reply`

### 8.5 Non-Negotiable Design Rules
1. Never hard-block — always fall back to local reply when quota exhausted
2. Never gate local replies — local is always free
3. Never show paywall during an active emotional conversation
4. Server-side enforcement only — client-side quota is spoofable and not used

---

## 9. Storage Architecture

### 9.1 Web
| Data | Storage | Key |
|------|---------|-----|
| Chat threads | localStorage | `imotara.chat.v1.{userId}` |
| Profile/settings | localStorage | `imotara.profile.v1` |
| Auth session | Supabase (httpOnly cookie via NextAuth) | — |
| License data | Supabase `licenses` table | Row-Level Security enforced |

### 9.2 Mobile
| Data | Storage | Key |
|------|---------|-----|
| Chat history | AsyncStorage | `imotara_history_v1:{scopeId}` |
| Settings/profile | AsyncStorage | `imotara_settings_v1` |
| Companion memories | expo-secure-store (Keychain/Keystore) | `imotara.companion.memories.v2` |
| Auth JWT | expo-secure-store | Supabase session keys |
| Theme preference | AsyncStorage | — |
| Streak / check-in flags | AsyncStorage | — |

---

## 10. Security

### 10.1 Implemented
- **Admin timing-safe auth** — `crypto.timingSafeEqual()` on ADMIN_SECRET comparison
- **Content Security Policy** — full CSP header on all web responses
- **Schema leak prevention** — API errors return generic messages, not raw DB errors
- **IDOR prevention** — all Supabase queries scoped to authenticated user's ID
- **Row-Level Security** — enforced on all user tables in Supabase
- **Razorpay webhook HMAC** — timingSafeEqual verified before any license upgrade
- **Apple IAP deduplication** — transactionId stored and checked before granting tier
- **Companion memories encrypted** — moved from AsyncStorage to device Keychain/Keystore (v1.1.1)
- **JWT in secure store** — Supabase access + refresh tokens in expo-secure-store, not AsyncStorage

### 10.2 Known Residual Risks
| Risk | Severity | Plan |
|------|----------|------|
| Chat history in plaintext AsyncStorage | Medium | Full migration to react-native-encrypted-storage (post v1.1.1) |
| No jailbreak/root detection | Medium | Address post-launch |
| No SSL certificate pinning | Low | Requires native module — planned post-launch |
| JS bundle not obfuscated | Low | Android ProGuard enabled; sensitive logic server-side |
| Anonymous endpoint spam (`x-imotara-user`) | Low | Vercel rate-limiting; no user data exposed |

---

## 11. Technical Stack Summary

| Layer | Web | Mobile |
|-------|-----|--------|
| Framework | Next.js 16, React 19 | Expo SDK, React Native |
| Language | TypeScript | TypeScript |
| Styling | Tailwind CSS v4, tailwind-variants | NativeWind / StyleSheet |
| Auth | NextAuth v4 + Supabase | Supabase JS + expo-secure-store |
| Database | Supabase (PostgreSQL) | Supabase (via API) |
| AI | OpenAI GPT-4.1-mini | OpenAI GPT-4.1-mini (cloud) + local engine |
| TTS | Azure Neural TTS | Azure Neural TTS + expo-speech fallback |
| STT | OpenAI Whisper | OpenAI Whisper (via Vercel API) |
| Payments | Razorpay | Razorpay (Android) + Apple IAP (iOS) |
| Hosting | Vercel | EAS Build + App Store / Play Store |
| State | Zustand + React Context | React Context + AsyncStorage |
| Forms | react-hook-form + Zod | Custom controlled inputs |
| Charts | Recharts | react-native-gifted-charts |
| Push | — | Expo Notifications (FCM + APNs) |

---

## 12. Known Constraints & Limitations

### 12.1 AI Quality
- **Local reply engine is template-based** — it cannot understand nuance, detect sarcasm, or generate novel responses. Quality gap vs cloud is significant for complex emotional situations.
- **GPT-4.1-mini** is cost-optimised. Some nuanced emotional responses that GPT-4.1 handles well are slightly flatter with mini. Upgrade path exists (env var only, no code change needed).
- **Emotion detection is keyword-based** on device. It can misfire on short messages, mixed-script messages, or ironic phrasing.

### 12.2 Language Detection
- Latin-script languages (es / fr / pt / id / de) can fall through to English in the local engine because they share Unicode range with English. The `preferredLang` setting mitigates this but doesn't eliminate it.
- Gujarati romanised messages are sometimes detected as Bengali.
- Marathi Devanagari is sometimes misread as Hindi (shared script, different vocabulary).

### 12.3 Storage
- Chat history is stored in plaintext AsyncStorage on mobile. Device-level encryption (filesystem encryption on modern iOS/Android) provides some protection, but dedicated in-app encryption is not yet in place for history.
- Web localStorage has no encryption — relies on browser-level security and OS disk encryption.

### 12.4 TTS
- Azure Neural TTS adds latency (~300–800ms before audio starts). On slow connections this feels sluggish.
- Native expo-speech was abandoned for chat replies because it ignores the gender parameter — device-default voice overrides companion gender setting silently.
- English always uses Azure (for gender consistency) — this means English TTS is not offline-capable.

### 12.5 Mobile Bundle Size
- v1.1.0 shipped at 107 MB install / 88.8 MB update — significantly above typical wellness app sizes.
- v1.1.1 reduces this to ~65 MB via avatar PNG compression (48 MB → 13 MB) and WAV → MP3 conversion (3.9 MB → 392 KB).
- Further reduction would require serving avatars from CDN instead of bundling, which adds an internet dependency for avatar display.

### 12.6 App Store Category
- Primary category is locked as Entertainment post first-submission. Apple requires a support ticket to change to Health & Fitness. This is in progress.

### 12.7 Offline Completeness
- Voice input (Whisper STT), TTS, and cloud AI all require internet. The offline fallback covers AI replies only.
- Companion's Letter, Emotional Arc, and Year in Review all require cloud AI — they do not work offline.

---

## 13. Areas of Improvement

### 13.1 High Priority
| Area | Problem | Fix |
|------|---------|-----|
| Chat history encryption | Plaintext on device | react-native-encrypted-storage migration |
| Local engine quality | Template-based, limited depth | LR-4: Combinatorial template assembly (4096+ combos) |
| Language detection | es/fr/pt/id/de Latin fallback | Expand keyword lists per language |
| Bundle size | 65 MB still large | CDN-served avatars, lazy loading |
| Rain sound | EQ-processed but not natural | Replace with royalty-free recording |

### 13.2 Medium Priority
| Area | Problem | Fix |
|------|---------|-----|
| AI model | GPT-4.1-mini misses nuance | Upgrade to GPT-4.1 when revenue allows |
| TTS latency | 300–800ms startup delay | Pre-buffer first 2 seconds while streaming |
| Wit layer | Local replies are always empathetic, never playful | LR-3: Conditional wit on okay/tired + close_friend tone |
| Jailbreak detection | No root/jailbreak check on mobile | Expo native module post-launch |
| SSL pinning | No certificate pinning | Native module integration |

### 13.3 Low Priority
| Area | Problem | Fix |
|------|---------|-----|
| Gujarati romanised detection | Misidentified as Bengali | Expand Gujarati keyword list |
| Marathi/Hindi overlap | Shared Devanagari script | Vocabulary-based disambiguation |
| Bengali language slip at turn 3 | Hindi-like words shift detection | Confidence threshold + sticky lang |

---

## 14. Future Extensibility

### 14.1 AI Model Upgrade
The current model (`gpt-4.1-mini`) is configurable via a single Vercel environment variable (`IMOTARA_AI_MODEL`). Upgrading to `gpt-4.1` or any future OpenAI model requires zero code changes — just an env var update. This was architected deliberately to decouple model choice from deployment.

### 14.2 New Languages
The language system is additive. Adding a new language requires:
1. A BCP-47 entry in the language map
2. Template bank additions in `localReplyEngine.ts` (both web + mobile)
3. Native wisdom fragments in `nativeWisdomEngine.ts`
4. An Azure TTS voice mapping in `voices.ts`
5. Two pre-generated preview MP3s (`{lang}-male.mp3`, `{lang}-female.mp3`) on the CDN

No structural changes needed.

### 14.3 Teen Insights Mode (GAP-12)
Architecture already includes age-adaptive tone. A dedicated teen mode would layer additional guardrails (crisis escalation at lower thresholds, simplified language, no relationship-vibe options that feel romantic) on top of existing infrastructure. Needs careful safety review before ship.

### 14.4 Family Emotional Dashboard (NF-3)
The `family` license tier already exists in the DB schema and feature gate matrix. The feature itself (shared emotional status across family members with explicit consent gates) needs UI and a shared-group data model in Supabase.

### 14.5 Grief & Loss Protocol (NF-2)
A dedicated conversation mode for loss — slower pacing, longer silences between AI responses, specific language around grief stages. The prompt system already supports conversation-mode overrides. Requires a new mode selector and prompt layer.

### 14.6 Cultural Emotion Vocabulary (P2)
Each language has emotion words with no direct English translation (Portuguese: *saudade*, Japanese: *mono no aware*, Bengali: *বিষণ্নতা* beyond sadness). The AI can be guided to introduce and use these words in the appropriate language — making responses feel culturally authentic rather than translated.

### 14.7 Bundled LLM (Do Not Do)
Running a local LLM (Llama, Mistral, etc.) on device has been explicitly ruled out. The smallest usable model is ~500 MB — a catastrophic UX for a wellness app. The pattern-matching local engine is the intentional offline strategy.

### 14.8 Progressive Web App
The web app is currently not a PWA. Adding a service worker + offline caching would let web users get the local reply fallback without installing the mobile app. This aligns well with the privacy-first approach.

### 14.9 Wearable Integration
The architecture does not currently support wearables. Heart rate data from Apple Watch or Wear OS could supplement emotion detection (e.g., elevated HR + anxious keywords = confirm anxiety signal). This would require HealthKit / Google Fit integration.

### 14.10 Therapist Mode
A professional-facing view where a therapist can (with user consent) see anonymised emotional patterns to supplement sessions. Requires strict consent architecture and possibly HIPAA-adjacent compliance. Long-term vision, not near-term.

---

## 15. Release History (Summary)

| Version | Build | Date | Key Changes |
|---------|-------|------|-------------|
| 1.0.9 | 77 | Apr 2026 | Initial public release |
| 1.0.10 | 78 | Apr 2026 | Bug fixes, UI polish |
| 1.1.0 | 82 | May 2, 2026 | Voice input (Whisper STT), Azure Neural TTS for all platforms, companion gender voice fix, offline banner fix, Android payment sign-in fix, markdown stripping before TTS |
| 1.1.1 | 83 | May 3, 2026 | Avatar PNG compression (48 MB → 13 MB), WAV → MP3 sounds, companion memory migrated to device Keychain, enhanced rain audio |

---

## 16. Repository Structure

```
imotaraapp/                          ← Next.js web app
  src/
    app/
      api/
        respond/route.ts             ← Cloud AI reply (SSE streaming)
        chat-reply/route.ts          ← Cloud AI reply (mobile + quota)
        tts/route.ts                 ← Azure Neural TTS endpoint
        voice/transcribe/route.ts    ← OpenAI Whisper STT
        license/                     ← License verify + status
        admin/                       ← Admin panel API (ADMIN_SECRET gated)
      chat/page.tsx                  ← Main chat interface
      admin/page.tsx                 ← Admin panel UI
    lib/
      ai/local/localReplyEngine.ts   ← Web local reply engine
      azure-tts/                     ← TTS voice map + region router
      imotara/                       ← Prompt building, license, sync
      emotion/keywordMaps.ts         ← Centralized emotion detection
  public/
    sounds/                          ← Breathing ambient sounds (MP3)
    tts-preview/                     ← 42 pre-generated TTS preview MP3s

imotara-mobile/                      ← Expo React Native app
  src/
    screens/
      ChatScreen.tsx                 ← Main chat UI + voice input
      TrendsScreen.tsx               ← Mood charts + journal
    state/
      HistoryContext.tsx             ← Chat history management
      SettingsContext.tsx            ← Profile + tier + feature gates
      companionMemory.ts             ← User fact storage (SecureStore)
    lib/
      tts/mobileTTS.ts               ← Azure TTS + expo-speech fallback
      ai/local/localReplyEngine.ts   ← Mobile local reply engine
      ai/local/nativeWisdomEngine.ts ← 320 cultural wisdom fragments
      supabase/client.ts             ← Supabase + expo-secure-store auth
    components/imotara/
      BreathingModal.tsx             ← Guided breathing with ambient sound
      UpgradeSheet.tsx               ← Payment + license upgrade UI
  assets/
    avatars/male/ female/            ← Age-based avatar images (PNG)
    sounds/                          ← Breathing ambient sounds (MP3)
```

---

## 17. Guiding Principles for Future Development

1. **The companion must never feel like a product.** It must feel like a presence. Every design decision should serve that feeling — including what is not shown (no badges, no streaks-as-pressure, no dark patterns).

2. **Emotional conversations are sacred.** No paywall, no interrupt, no upsell during an active conversation. The moment a user is mid-thought about something painful, the product gets out of the way completely.

3. **Local first, cloud as enhancement.** The app must be usable without a network connection. Cloud makes it richer, not possible.

4. **Privacy is the product, not a policy.** No analytics on emotional content. No training data collection from user conversations. No third-party tracking SDKs.

5. **Language is not a feature — it is respect.** Supporting 22 languages is not a market expansion move. It is the recognition that a person's emotional vocabulary is richer in their mother tongue.

6. **Ship in layers, never break trust.** Imotara deals with mental wellbeing. A bug that causes a jarring or cold response at the wrong moment can damage a user's willingness to open up. Stability and warmth are non-negotiable.
