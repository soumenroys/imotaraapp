# Imotara — Web App Technical Guide

The web app (`imotaraapp`, `github.com/soumenroys/imotaraapp`) is both the user-facing web client at **www.imotara.com** and the **entire backend** for the mobile app — all API routes, payments, admin, org, and Connect logic live here. Current release: **v1.2.7**.

## 1. Tech stack

- **Next.js 16.1.6** (App Router) + **React 19.2** with the React Compiler enabled (`reactCompiler: true` in `next.config.ts`), **TypeScript 5.9 strict**.
- **Tailwind CSS v4** (`@tailwindcss/postcss`), `class-variance-authority`, `tailwind-variants`, icons via `lucide-react` + Radix icons.
- **Supabase (Postgres)** via `@supabase/ssr` + `@supabase/supabase-js`; auth via `next-auth` v4 + Supabase adapter. **Prisma 6 is installed but unused** — `prisma/schema.prisma` is an empty stub; the real schema lives in raw SQL under `docs/sql/` (see the Database & Backend Reference doc).
- **AI:** OpenAI (`gpt-4.1-mini` via `IMOTARA_AI_MODEL`) with Gemini disaster-recovery fallback; **Azure Neural TTS**; **OpenAI Whisper** STT.
- **Payments:** Razorpay (primary, India + intl) + Stripe; Apple IAP and Google Play verification for mobile purchases.
- **Other:** `zustand` v5, `react-hook-form` + `zod` v4, `recharts` v3, `nodemailer`, `web-push` + VAPID, `otplib` + `qrcode` (admin 2FA), `date-fns`, Playwright (screenshot test).
- **Hosting:** Vercel, deploy on push to `main`. `vercel.json` defines **9 cron jobs**. Security headers/CSP set in `next.config.ts` (Razorpay + Supabase allowed, X-Frame-Options DENY, HSTS).
- **Middleware:** `src/proxy.ts` (Next 16's renamed middleware) — refreshes Supabase session cookies on every request and 404s dev/debug/`license-debug` routes in production.
- **No GitHub Actions CI** — release gates are manual/scripted (see Release Runbook).

## 2. Repo layout

```
imotaraapp/
├─ prisma/schema.prisma      # STUB — no models; docs/sql/ is the real schema
├─ public/                   # icons, manifest, sw.js, sounds/, tts-preview/ (42 MP3s), avatars/
├─ scripts/                  # devRoutes.mjs, bump-version.mjs, ping-sitemap.mjs,
│                            #   generate-tts-previews.mjs, ~15 generate-*-pdf.js marketing generators
├─ tests/imotara-ai/         # E2E AI eval harness: runner.ts, judge.ts, scenarios.<lang>.ts (22 langs)
├─ docs/                     # ARCHITECTURE.md, IMOTARA_OVERVIEW.md, LICENSING.md, CHANGELOG_v1.2.7.md,
│  ├─ sql/                   #   68 raw SQL migration files (the actual DB schema)
│  └─ *.pdf / *.html         #   marketing/licensing/vision decks, test plans, audits
└─ src/
   ├─ proxy.ts               # middleware
   ├─ app/                   # App Router pages + api/ route handlers (~130 endpoints)
   ├─ components/            # UI: blog/, connect/, imotara/ (50+ domain components)
   ├─ content/blog/          # blog posts as .tsx modules (multilingual)
   ├─ hooks/                 # useImotara, useLicense, useFeatureGate, useOrgContext, useAutoSync, …
   ├─ lib/                   # core logic (see §5)
   ├─ store/                 # Zustand: emotionHistory.ts
   ├─ types/                 # analysis, chat, choice, history, license, sync
   └─ __tests__/, __mocks__/ # Vitest unit tests
```

## 3. Routing map (pages)

- **Marketing/SEO:** `/`, `/about`, `/ai-emotional-support`, `/ai-mental-wellness`, `/mood-tracker-app`, localized `/bn` `/hi` `/ta`, `/blog` + `/blog/[slug]`, `/careers`, `/privacy`, `/terms`, `robots.ts`, `sitemap.ts`, `rss.xml`.
- **Core app:** `/chat` (the big one, ~4,000 lines), `/history`, `/feel`, `/grow`, `/reflect`, `/profile`, `/settings`, `/tutorial`, `/guide`, `/family/view`.
- **Commerce:** `/donate`, `/pricing/corporate`, `/upgrade`.
- **Org:** `/org/new`, `/org/join/[slug]`, `/org/invite/[token]`, `/org/dashboard/{overview,members,teams,pool,licenses,analytics,audit,settings}`.
- **Connect:** `/connect`, `/connect/register`, `/connect/session/new`, `/connect/session/[id]`, `/connect/wallet-terms`, `/connect/age-restricted`.
- **Admin:** `/admin` (single large role-aware page, ~3,300 lines) + `/admin/guide`.
- **QA-only (pruned from prod builds):** `/dev/*`, `/license-debug`.

## 4. Auth model (two separate systems — don't conflate)

1. **End-user auth:** Supabase Auth — Google OAuth, email magic link, Apple Sign-In. Web uses httpOnly session cookies (refreshed in `src/proxy.ts`); mobile sends `Authorization: Bearer <supabase_jwt>`. Anonymous users supported via anonymous Supabase identities with tighter quotas. `user_bans` + a real Supabase-level ban block sign-in/refresh for banned users (note: an already-issued token can survive up to ~1h until refresh).
2. **Super-admin system (Imotara operators):** completely separate — `super_admins` table with scrypt-hashed passwords (`src/lib/imotara/adminCrypto.ts`: 12-char complexity policy, 5-attempt lockout/15 min, TOTP 2FA), sessions as SHA-256 token hashes with 8h TTL, cookie `imotara_admin_session`. Roles: `owner`, `admin`, `connect_reviewer`. See the **Admin Guide** doc for all procedures.

## 5. Core libraries (`src/lib/`)

- `ai/` — `orchestrator/runImotara.ts` (~4,260 lines, the reply brain), `emotion/`, `cultural/`, `guardrails/` (finalResponseGate, softEnforcement), `local/` (offline engine), `safety/` (adultContentGuard, crisisResources).
- `imotara/` (~65 files, the domain core) — `aiClient.ts` (OpenAI+Gemini), `analyze*/respond*` (consent-gated analysis), `promptProfile/chatTone/reflectionTone` (persona→prompt), `sync*/conflict*` (offline sync engine), `companionLetter/emotionalArc/yearInReview` (premium narrative features), `grantLicense/seedLicense`, `featureGates.ts`, `org.ts`, `apiKeyAuth/ipRateLimit`, `webpush/pushLedger`, `invoiceUtils`, `adminCrypto`, `userScope`.
- `azure-tts/` — `voices.ts` (22-language gender-matched voice map), `regionRouter.ts` (route by `x-vercel-ip-country`).
- `connect/`, `wallet/`, `donations/`, `memory/`, `emotion/`, `supabase/` (`supabaseServer.ts` service-role admin client; `supabase/userServer.ts` cookie-scoped user client).

**State:** Zustand store `src/store/emotionHistory.ts` (persisted to localStorage, SSR-safe) + custom hooks (`useImotara`, `useLicense`, `useFeatureGate`, `useOrgContext`, `useAutoSync`, `useSyncHistory`, `useOnlineStatus`, `useAppearance`).

## 6. API surface (summary — full catalog in Database & Backend Reference)

~130 route handlers under `src/app/api/`. Areas: AI (`respond`, `chat-reply`, `analyze`, `mindset-analysis`), TTS/STT (`tts`, `voice/transcribe`), sync (`history`, `chat/messages`, `memory`, `profile/sync`, `export`, `delete-remote`, `account/delete`), licensing/payments (`license/*`, `payments/*`, `subscription/cancel`, `invoice/*`), org (`org/*` incl. the large `org/dashboard/*` set and public `v1/org/*` API-key API), admin (`admin/*`), Connect (`connect/*`), wallet, cron (9 jobs, `CRON_SECRET` Bearer-gated), plus `health`, `pulse`, `social-proof`, `blog/comments`, `careers/apply`, `settings-search`, `push/subscribe`.

## 7. Environment variables

From `.env.example`: Supabase (`NEXT_PUBLIC_SUPABASE_URL/ANON_KEY`, `SUPABASE_URL/ANON_KEY/SERVICE_ROLE_KEY`), NextAuth (`NEXTAUTH_URL/SECRET`), `NEXT_PUBLIC_IMOTARA_API_BASE_URL`, AI (`OPENAI_API_KEY`, `IMOTARA_AI_MODEL`, `IMOTARA_OPENAI_BASE_URL`), licensing flags (`NEXT_PUBLIC_IMOTARA_LICENSE_MODE`, `LAUNCH_DATE`, `FREE_DAYS`), Razorpay (`RAZORPAY_KEY_ID/SECRET/WEBHOOK_SECRET`, `RAZORPAY_CONNECT_KEY_SECRET`, `NEXT_PUBLIC_RAZORPAY_KEY_ID`), VAPID push keys, `CRON_SECRET`, SMTP (`SMTP_HOST`, `ALERT_GMAIL_USER/APP_PASSWORD`, `CONNECT_PLATFORM_EMAIL`), admin (`ADMIN_SECRET`, `ADMIN_SECRET_DISABLED=true`).

> **Known gap:** Azure TTS and Stripe key names are used in code but NOT listed in `.env.example` — check `src/lib/azure-tts/regionRouter.ts` and the Stripe client for exact names before touching those areas.

## 8. Testing

- **Vitest** unit tests in `src/__tests__/` with `src/__mocks__/`.
- **AI eval harness** in `tests/imotara-ai/`: `runner.ts` (E2E driver), `judge.ts` (LLM-as-judge), `coherence-audit.ts`, per-language `scenarios.<lang>.ts` for all 22 languages — wired to ~90 npm scripts (`test:ai:e2e:<lang>[:mobile][:verbose]`).
- Root `tests/*.mjs` (full-test-suite, language-reply, psychological-tools) — `full-test-suite.mjs` is a release gate.
- `screenshot-test.js` (Playwright). No CI runs any of these automatically.

## 9. Fragile areas / gotchas

- **Migrations are unmanaged raw SQL** (68 files in `docs/sql/`, applied by hand, ordered by convention). Connect went through 37 hardening passes — its billing/RLS logic is intricate and race-prone. Prisma is a decoy.
- **`runImotara.ts` is ~4,260 lines**; `/chat` and `/admin` pages are multi-thousand-line single files. Heavy to refactor; lots of inline language/regex heuristics.
- **Licensing is dual-sourced:** client-side env-flag/launch-offer path (currently `off` = everything open) vs real server enforcement (20/day quota + org RPC tiers). Never trust the client gate for security; source of truth is `resolve_user_tier` + the `/api/chat-reply` quota.
- **Language detection is acknowledged-imperfect** (Gujarati↔Bengali romanized confusion, Marathi↔Hindi Devanagari overlap).
- **Auth is bifurcated** (Supabase user auth vs bespoke scrypt/2FA super-admin) — don't conflate.
- Repo root also carries mobile config (`app.json`, `eas.json`) used by the shared bump-version script, plus marketing PDF generators — the actual mobile app is the separate `imotara-mobile` repo.

## 10. Recent development themes (v1.2.7)

The v1.2.7 release was dominated by a 5-pass **NGO/org licensing security audit** (29 findings): cross-org seat leaks, seat-pool capacity leaks, TOCTOU races on org creation, real user banning, global API-key rate limiting, `connect_reviewer` privilege-escalation fix, Imotara-owner org-delete, NGO verification approve/reject — plus honest de-scoping of overclaimed features (LMS embed, referral tracking, Impact Report "PDF" → "Coming soon"/corrected), TTS reliability fixes, and payment security hardening (server-side Stripe price computation, Apple IAP fail-closed, cross-tenant IDOR fixes).
