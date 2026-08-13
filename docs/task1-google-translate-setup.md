# Task 1: Google Cloud Translation Setup

Part of the Voice & Reply Quality Remediation project — Track 1, item 1.
Fixes: Connect session-level auto-translation currently produces semantically wrong output because it runs on
MyMemory, a free crowd-sourced translation-memory lookup service, not real machine translation. See the full
root-cause writeup in memory (`connect_translation_quality_bug_2026_08_12`) for the reproduced failure case.

## 1. Description of the requirement

`translateText()` in `src/lib/connect/translate.ts` already has a working Google Cloud Translation code path —
it's just never been activated, because `GOOGLE_TRANSLATE_API_KEY` has never been set in any environment. Once
that key exists, the function automatically prefers Google Cloud Translation over MyMemory, with zero further
code changes needed. This task is entirely about provisioning that key — Google Cloud account/project setup,
enabling the API, creating a properly-restricted key, and wiring it in — not about writing new code.

**Decision already made** (see memory `voice_reply_quality_project_plan_2026_08_12`): Google Cloud Translation
was chosen over Azure Translator and an LLM-based approach for best published quality across Imotara's specific
22-language mix, especially Indic languages, and because it needs no new integration code.

## 2. Actions to be taken

1. Confirm/use a Google Cloud project with billing enabled.
2. Enable the Cloud Translation API for that project.
3. Create an API key, restricted to only the Cloud Translation API.
4. Add the key to the web app's environment as `GOOGLE_TRANSLATE_API_KEY`.
5. Verify `translateText()` actually picks it up and produces correct output — specifically re-testing the exact
   failure case already reproduced against MyMemory, to confirm the fix.

## 3. Step-by-step tasks

- [x] **3.1 — Confirm a Google Cloud project exists.** Already done: project `imotara` (Project ID: `imotara`,
      Project number: `425826097896`) exists and is in active use for other Google services (OAuth clients for
      Imotara Android/iOS/Web already present under Credentials).
- [x] **3.2 — Confirm billing is enabled.** Already done: "Imotara Billing Account" is active and linked
      (Paid account status confirmed on the Billing Overview page), with a ₹2,000/month budget alert already
      configured. No new billing setup needed.
- [x] **3.3 — Enable the Cloud Translation API.** Already done: `console.cloud.google.com/apis/library/translate.googleapis.com?project=imotara`
      → clicked **Enable** → confirmed Status: **Enabled** on the API/Service Details page
      (`translate.googleapis.com`, Type: Public API).
- [x] **3.4 — Create a restricted API key.** Done: key named "Imotara Translation Key" created under
      APIs & Services → Credentials, restricted to Cloud Translation API only. **Gotcha hit and resolved**: the
      first copy of the key (manually read off-screen) was 38 characters instead of the standard 39 and failed
      with `API key not valid` when tested directly against `translation.googleapis.com`. Re-copied via the
      "Show key" modal's copy-to-clipboard icon instead of manual transcription — fixed it. Lesson: always use
      the copy icon for API keys, never retype from a screenshot.
- [x] **3.5 — Add the key to the web app's environment.** Done: `GOOGLE_TRANSLATE_API_KEY` added to
      `imotaraapp/.env.local` (gitignored, never committed). Production Vercel env var still **explicitly
      deferred by the user** — they'll add it themselves at publish time, not now.
- [x] **3.6 — Verify `translateText()` picks up the key automatically.** Done, confirmed two ways:
  1. Direct call to `translation.googleapis.com` with the key — succeeded once the corrected key was in place.
  2. Live test against the real `/api/connect/translate` route (not a reimplementation) via a Bearer-token test
     request, dev server restarted to pick up the new env var. Zero code changes were needed — exactly as
     expected, `translateText()` in `src/lib/connect/translate.ts` picked up `GOOGLE_TRANSLATE_API_KEY`
     automatically and stopped calling MyMemory.
  - Results: `en→bn "hi"` → `"হাই"` (correct casual greeting — MyMemory previously returned Bengali for
    "how are you", completely wrong). `en→hi`, `en→ta`, `en→ar` full-sentence tests all produced accurate,
    fluent translations. `bn→en "Kotha bolbo"` (the exact original bug report, romanized Bengali) returned the
    text **unchanged** — no longer confidently wrong (MyMemory returned "kotha ghorano", a different meaning),
    but also not actually translated. This is the known romanized-text limitation already flagged in the
    project plan (Track 1.3) — a fail-safe outcome now, not a fail-wrong one, but not fully solved either.
- [x] **3.7 — Track 1, item 1 marked complete.** Moving to item 2 (MyMemory quota-warning-text guard, kept as a
      safety net in case this key is ever missing/rate-limited and the code falls back).

## 4. Expected outcome — ACHIEVED 2026-08-13

- `GOOGLE_TRANSLATE_API_KEY` is set in local `.env.local` (production Vercel var still deferred to publish time
  by user request).
- A restricted-scope API key ("Imotara Translation Key") exists in the `imotara` Google Cloud project, limited
  to Cloud Translation API only.
- No code changes were needed in `translate.ts` — the existing Google Cloud Translation path was dormant and is
  now live, confirmed via a real request through `/api/connect/translate`.
- Well-formed-script translations (native script or full English sentences) now produce correct, fluent output
  — clear improvement over MyMemory's wrong/garbled results.
- The originally-reported exact bug case (`"Kotha bolbo"`, romanized Bengali) no longer produces a wrong
  translation — it now fails safe (returns unchanged) rather than failing wrong. Full resolution of the
  romanized-text case is tracked separately as Track 1.3, not required for this item to be complete.
- This directly fixes the reported Connect translation-quality bug for both call sites that share
  `translate.ts` (session-level auto-translate and the manual per-viewer picker), on both web and mobile, since
  mobile has no separate translation logic of its own.
