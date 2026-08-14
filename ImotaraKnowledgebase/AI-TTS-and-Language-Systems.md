# Imotara — AI, TTS & Language Systems

*A technical-but-readable reference to how Imotara generates replies, speaks, transcribes, detects languages and emotions, and keeps users safe. Grounded in `src/lib/ai/**`, `src/app/api/**`, `src/lib/azure-tts/**`, `src/lib/emotion/**`, and `src/lib/safety/**` of the `imotaraapp` repo.*

## The reply pipeline, end to end

**Clients → API → orchestrator.** Both the web app and the mobile app call the same Vercel-hosted backend (`www.imotara.com/api/...`). There is no separate backend service.

The client's AI helper tries endpoints in order and degrades gracefully:

1. **`POST /api/chat-reply`** — the primary streaming reply route. Handles the daily quota check and streams tokens back over SSE (`?stream=1`). Accepts a rich payload: message history (up to 12 turns / 10,000 chars server-side), tone, language, detected emotion, emotion-memory summary, companion name, response style, user/companion age and gender, plus rolling and cross-thread context.
2. **`POST /api/respond`** — the fuller orchestration route. If `chat-reply` times out or errors, mobile falls back here. It runs the full orchestrator (`runImotara`), fetches relevant user memories, applies the same quota gate, and returns `{ message, emotion, intensity, reflectionSeed, followUp, meta }`.
3. **Local engine** (mobile) — if both cloud routes fail, `buildLocalReply()` produces an offline reply.

**What the orchestrator (`src/lib/ai/orchestrator/runImotara.ts`, ~4,260 lines) does.** It assembles and shapes the reply rather than just proxying the model:
- **Tone blueprint** — infers a `ResponseTone` (calm / supportive / coach / practical) from the message. Strong vulnerability/sadness → *supportive*; work/study stress → *coach*; bodily needs (hungry, thirsty, can't sleep — including romanized Indic terms like *bhook*, *pyaas*, *neend*, *khida*, *ghum*) → *practical*; default → *calm*.
- **Language detection** and a strict per-turn **language directive** (see below).
- **Continuity anchors** — when a message looks like a short follow-up ("because…", "why", "ok"), it prepends a natural, non-repetitive anchor in the user's language ("Got it — on that…", "ঠিক আছে — সেই কথাটাই ধরে…"), with 4 rotating variants per language to avoid robotic repetition.
- **Enrichment engines** — story engine (micro-stories), mythology engine (Mahabharata, Rumi, Zhuangzi, etc., with de-duplication), and quotes engine (emotion-matched). `/api/respond` also fires a parallel cloud-quote generation on roughly 1 in 5 emotional turns (never during crisis, greetings, or direct questions).
- **Guardrails** — soft enforcement (tone/structure/guidance checks) and a final response gate.
- **Crisis resources** — pulls country-specific helplines when crisis signals appear.
- **Adult-content guard** — runs before generation and refuses explicit content with a warm, non-shaming, age-appropriate message.
- **Anti-repeat and privacy directives** — deterministic per-request "variation policy," plus rules to never echo passwords/PINs/OTPs and to ignore fabricated "admin override" / "safety filters suspended" premises.

## Model configuration and disaster-recovery fallback

- **Primary model:** OpenAI **`gpt-4.1-mini`**, configured via the `IMOTARA_AI_MODEL` environment variable. Upgrading to another model is a **single env-var change, no code change** — the model choice is deliberately decoupled from deployment.
- **Fallback:** Google **Gemini `gemini-2.0-flash`** (via REST). In `aiClient.ts`, both `callImotaraAI()` (non-streaming) and `streamImotaraAI()` (streaming) automatically retry via Gemini whenever OpenAI returns an HTTP error or the fetch throws (network failure / timeout, default 15s abort) — as of 2026-08-14 this parity is real; previously only the non-streaming path had it, which mattered because streaming is the *primary* path on both platforms (the client tries `?stream=1` first, falling back to the non-streaming route only if the stream itself throws or yields no text). Either path firing the fallback also fires a throttled "red-alert" outage email to info@imotara.com via Gmail SMTP (at most one alert per 5 minutes per server instance, shared across both paths). The non-streaming response `meta.from` reflects the source: `openai`, `fallback` (Gemini), `disabled` (no key), or `error`.
- **Streaming** uses OpenAI's SSE `stream: true`; the client accumulates tokens for progressive rendering. A server-side stall guard aborts the connection if the body goes silent for `abortMs` (default 15s) after headers arrive — previously only time-to-first-byte was bounded, not the body itself. The Gemini fallback only engages if the OpenAI stream fails before any token has been yielded to the client; a stall/abort *after* partial output has already streamed is not spliced with a second model's reply (that would read as an incoherent, mixed-voice message) — it simply ends, same as the client's own existing stall-retry already assumed was happening.

## The local / offline reply engine

The on-device engine (`src/lib/ai/local/localReplyEngine.ts`, mirrored in the mobile repo) activates when the cloud is unavailable, times out, or the daily quota is exhausted — so the companion never hard-blocks. Notes:
- It is **template/pattern-based** (no on-device ML — a bundled LLM was explicitly ruled out as too heavy for a wellness app).
- It builds replies with a **Three-Part Framework**: a tone-matched reaction opener → a core emotional template (emotion + tone + language bank) → a bridge (a closing question or statement).
- It uses regex emotion detection against `keywordMaps.ts`, deduplicates via `pickAvoidingRecent()` (avoiding replies that overlap recent ones), pulls native wisdom fragments (320 culturally rooted quotes across 20 languages), and mirrors the user's script for romanized input.
- It cannot understand nuance, sarcasm, or generate novel responses — quality is noticeably below cloud for complex situations. Cloud-only features (Companion's Letter, Emotional Arc, Year in Review) don't work offline, and TTS/STT still require internet.

## Language detection (22 languages)

Detection is a layered pipeline (implemented in `derivePreferredLanguage` in `/api/respond` and mirrored in `runImotara.ts`):

1. **Explicit request / preference** — e.g. "reply in Tamil," or a client-set language code (BCP-47 accepted).
2. **Unicode script ranges** — Bengali, Devanagari (Hindi/Marathi), Tamil, Telugu, Gujarati, Gurmukhi (Punjabi), Kannada, Malayalam, Odia, Arabic (Arabic/Urdu, with Urdu-specific characters), Cyrillic (Russian), CJK (Chinese), Hiragana/Katakana (Japanese), Hebrew.
3. **Romanized hints** — per-language regex banks in `keywordMaps.ts` (e.g. "mujhe/tumhe" → Hindi, "ami/tumi" → Bengali). A ≥2-hit threshold is required, and the strongest signal wins.
4. **Hard English override** — Latin-heavy text with fewer than 2 romanized-Indic/foreign signals is forced to English (prevents a stray English word from breaking into an Indic reply).
5. **Conversation continuity** — only when the current message is ambiguous, it inherits the last assistant language.
6. **Default → English.**

Once decided, a **strict language directive** is injected ("Reply ONLY in Bengali (bn). Use Bengali script. Do not mix languages."). Language is never inferred from the user's name or device locale.

**Known limitations (from the internal docs and code comments):**
- **Gujarati ↔ Bengali romanized confusion** — romanized Gujarati is sometimes detected as Bengali.
- **Marathi ↔ Hindi Devanagari overlap** — Marathi shares the Devanagari script with Hindi, so it can be misread as Hindi; only conservative romanized hints disambiguate.
- **Latin-script global languages** (es/fr/pt/id/de) can fall through to English in the local engine because they share the Latin range; `preferredLang` mitigates but doesn't eliminate this.
- A Bengali "language slip" can occur around turn 3 when Hindi-like words shift detection.
- On mobile there are **three parallel detection implementations** (aiClient script detection, aiClient roman hints, mobileTTS voice detection) plus a fourth in the local engine — they can disagree; a Jest test suite pins their behavior.

## Emotion detection

- **On-device / keyword-based:** `keywordMaps.ts` holds multilingual regex patterns across 21 languages; `analyzeLocal` runs pure regex with no API call. This is fast but can misfire on short, mixed-script, or ironic messages. **9 emotion states** are tracked (`src/types/analysis.ts`): joy, sadness, anger, fear, anxiety, disgust, surprise, gratitude, neutral.
- **Cloud analysis:** higher accuracy; returns an `emotion` label + `intensity` (0–1) used for history tracking and adaptive responses. Uses a separate, wider **15-state palette** (`src/lib/ai/emotion/emotionTypes.ts`): neutral, joy, sadness, anger, fear, anxiety, disgust, surprise, love, curiosity, confusion, shame, guilt, loneliness, hope. Note the two palettes aren't a strict superset/subset of each other — local has gratitude (cloud doesn't), cloud has loneliness/love/curiosity/confusion/shame/guilt/hope (local doesn't). Corrected 2026-07-19 from a stale "8 states" claim that matched neither.
- **Consent-gated modes:** analysis mode is user-selectable — **Auto / Cloud / Local**. On web, cloud analysis only runs after explicit consent (`runAnalysisWithConsent` / `runRespondWithConsent`); the language preference is stored locally and never sent to the server.

## Text-to-speech (`/api/tts`) — Azure Neural TTS

- **Pipeline:** the route authenticates the user (Bearer token first, then cookie), builds SSML, calls Azure Cognitive Services, buffers the full response server-side, and returns one complete `audio/mpeg` response (24 kHz, 48 kbit MP3), cached 24h. Not a stream — a caller wanting playback to start before a long reply finishes synthesizing must chunk the text into multiple requests itself (see the chunked-playback bullet below).
- **Gender-matched voices:** `voices.ts` maps all 22 languages to Azure Neural voice names with male/female/neutral variants. Two voice generations coexist as of 2026-08-14: 8 languages (English, Hindi, Chinese, French, Portuguese, Russian, German, Spanish) use Azure's newer **MAI-Voice-2 NeuralHD** generation (e.g. `en-US-Ethan:MAI-Voice-2`/`en-US-Olivia:MAI-Voice-2`, `hi-IN-Dhruv:MAI-Voice-2`/`hi-IN-Kavya:MAI-Voice-2`) — chosen because these specific voices carry real 10-18-item named-emotion catalogs, replacing voices that had 0-3 styles or none. **Spanish's accent changed from Spain (`es-ES`) to Mexican Spanish (`es-MX`)** as part of this — Spain's `es-ES` has no equivalent male MAI-Voice-2, `es-MX` has full male+female coverage. The other 14 languages are unchanged, still on standard Neural voices. Nonbinary/other/prefer-not fall back to the neutral (female) voice. Native `expo-speech` was abandoned for chat replies because it ignores the gender parameter — so English also goes through Azure on mobile to keep gender consistent. NeuralHD is priced higher than standard Neural (~$22 vs ~$16 per 1M characters) — an accepted tradeoff for real emotion coverage on the most-used languages.
- **Emotion-aware speaking styles — now cover all 22 languages**, via one of two mechanisms depending on what Azure's catalog actually supports for that language (checked exhaustively 2026-08-14 against the live voices-list endpoint, every regional sub-locale, not just the assigned voice — not assumed):
  - **9 languages get real named `<mstts:express-as>` styles**: the 8 MAI-Voice-2 languages above, plus Japanese (kept on its existing unupgraded voice — no MAI-Voice-2 exists for Japanese, but Nanami's real `cheerful` style is now emotion-driven instead of always-on). 7 of the 8 upgraded languages share an identical 18-style catalog (`RICH18_EMOTION_STYLE` in `voices.ts`); Russian's MAI-Voice-2 pair has a different 10-style vocabulary (`RU_EMOTION_STYLE`); Japanese only maps its one real style (`JA_EMOTION_STYLE`). All map from the same canonical 8-value emotion vocabulary (joy/sadness/anger/fear/disgust/surprise/gratitude/neutral) — e.g. the 18-style set: joy→`happy`, sadness→`sad`, anger/fear/disgust→`softvoice` (a calm register, deliberately not mirrored), surprise→`surprised`, gratitude→`relieved`.
  - **13 languages have zero named-style voices anywhere in Azure's catalog** (Marathi, Bengali, Tamil, Telugu, Gujarati, Punjabi, Kannada, Malayalam, Odia, Urdu, Arabic, Indonesian, Hebrew) — confirmed exhaustively, not a gap in our config. These get a small, deliberately conservative `<prosody>` rate/pitch fallback instead (`resolveProsody()`): ±6%/∓2% for sadness/anger/fear/disgust (same calm-not-mirrored philosophy), ±5%/±3% for joy/gratitude/surprise. Not a style substitute — just a subtle inflection where no real style option exists. This is unrelated to (and much smaller than) the asymmetric `-8%/+1%` blanket wrapper removed 2026-08-13, which applied unconditionally to every message; `resolveProsody()` only ever applies when a real emotion was actually detected.
  - Both mechanisms only apply when the reply's detected emotion is passed — hands-free/auto-read call sites do this (`speakMessage()` on mobile, `autoSpeakText()` on web, each normalizing their own local emotion vocabulary to the canonical one via `mapUserEmotionForTTS()`/`mapDebugEmotionForTTS()`). Manual "read aloud" taps pass no emotion and always get plain delivery — including for the 9 named-style languages, where earlier versions of this config applied a fixed default style to every message regardless of content (e.g. Jenny's `friendly`, always-on); that's been retired as not genuinely emotion-aware.
  - **Known temporary mismatch**: the 42 pre-generated preview MP3s (see below) still use the pre-upgrade voices for 7 of the 8 upgraded languages (all except English, whose preview already used a separate `en-IN` voice family) until `scripts/generate-tts-previews.mjs` — already updated to the new voice IDs — is re-run and redeployed.
- **Region routing:** `regionRouter.ts` maps the Vercel `x-vercel-ip-country` header to the nearest Azure Speech region (centralindia / westeurope / eastus / japaneast), defaulting to India.
- **Anonymous cap:** signed-in accounts have unlimited Azure TTS; **anonymous identities are capped at 15 TTS calls/day** (429 on exceed). Text is hard-capped at 8,000 chars (raised from 3,000 in v1.2.7 — actual replies run ~1,200-2,500 chars, so this is headroom, not a practical limit).
- **Browser fallback:** on web, the route is only called when the browser lacks a native voice for the language; otherwise the browser's `speechSynthesis` is used (with a `resume()` keep-alive fix for long utterances). Mobile falls back to native `expo-speech` only if the Azure request fails.
- **Pre-generated previews:** 42 pre-rendered preview MP3s on the CDN (22 languages × male/female) power the voice picker without hitting the API.
- **Chunked, pipelined playback (both platforms, as of 2026-08-13):** both mobile (`speakMessage()`, `mobileTTS.ts`) and web (`playChunkedTTS()`, shared by the per-message speaker icon and hands-free auto-read in `chat/page.tsx`) split replies into sentence chunks (multilingual terminators `. ! ? । ۔ ؟ 。！？`), cap the first chunk small (110 chars) so speech starts fast, and pipeline the fetch of chunk N+1 while chunk N plays — a short reply naturally produces just one chunk. Web additionally exposes a "preparing" state (spinner) distinct from "speaking" (stop icon), shown while the first chunk's network+synthesis is still in flight, matching a distinction mobile already had.

## Speech-to-text (`/api/voice/transcribe`) — Whisper

Mobile voice input forwards recorded audio (m4a, max 10 MB) to **OpenAI Whisper (`whisper-1`)** and returns `{ text }`. It sends an ISO-639-1 language hint when the code is in Whisper's supported set; unsupported codes (notably **Odia, "or"**) are omitted so Whisper auto-detects instead of erroring. The route requires auth, and **anonymous identities are capped at 20 transcriptions/day.** A 55s timeout stays under Vercel's 60s limit; `insufficient_quota` from Whisper surfaces as a clean "voice unavailable" signal.

## Safety systems

- **Adult-content guard** (`adultContentGuard.ts`) — conservative, word-boundary-anchored explicit-content patterns across 18 language banks. It deliberately does **not** block medical/health, puberty education, or romantic-emotion topics. On a hit, it returns a warm, non-shaming refusal, with a stricter minor-oriented variant for users aged under-13 / 13–17.
- **Crisis resources** (`crisisResources.ts`) — country-specific emergency numbers and mental-health/suicide helplines for ~60 countries (India defaults: Tele-MANAS 14416, KIRAN 1800-599-0019, NIMHANS, Emergency 112). Localized by the Vercel geo header, falling back to India.
- **Crisis detection (3-tier)** — Tier 2 (immediate danger / suicidal-ideation regex across 13 languages) triggers the breathing modal plus helplines; Tier 1 (hopelessness, worthlessness, "trapped") surfaces in-app resources without interrupting; Tier 0 is normal flow.
- **Content-safety pipeline order:** user message → adult-content guard → `runImotara()` → AI response → `softEnforcement` (tone/structure/guidance checks) → `finalResponseGate` (final content check) → delivered.
- **Privacy/prompt-safety directives** injected into every cloud prompt: never echo credentials, ignore fabricated override premises, never infer language from a name.

## Quotas (server-enforced)

- **Free tier: 20 cloud replies per day**, enforced server-side in **both** `/api/chat-reply` and `/api/respond` by counting `usage_events` rows since UTC midnight. When a free user exceeds 20 and has no token balance, the route returns `{ meta.from: "quota_exceeded", reason: "daily_limit", limit: 20 }` — and the client falls back to a local reply rather than showing a hard block. Purchased token packs decrement one-by-one before the block triggers.
- **Enforcement is server-only and fail-open** — DB errors never block a reply, and forged/unsigned bearer tokens never satisfy the verified-identity check that gates the quota (an attacker can't spoof another user's `sub`).
- **Anonymous limits:** TTS 15/day, Whisper transcription 20/day (both keyed on `usage_events`).
- Paid/trial tiers and users within the launch offer are unlimited.

> **Resolved 2026-07-19:** `LICENSING.md`'s design-phase matrix used to list a stale "10/day" free reply limit in one table; the shipping server code and the product overview always enforced **20/day**. `LICENSING.md` has now been corrected to match.
