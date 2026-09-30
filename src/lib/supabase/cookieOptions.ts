// src/lib/supabase/cookieOptions.ts
//
// The ONE definition of how Supabase auth cookies are written.
//
// 🔴 WHY THIS FILE EXISTS — TWO REASONS, BOTH LEARNED THE HARD WAY.
//
// ── 1. `httpOnly: true` BROKE SIGNING IN, COMPLETELY, FOR MONTHS. ────────────
//
// These options used to carry `httpOnly: true`, added deliberately to stop an
// XSS reading the session out of `document.cookie`. The reasoning was sound in
// isolation and the effect was catastrophic:
//
//   `@supabase/ssr`'s BROWSER client stores and reads the session THROUGH
//   `document.cookie`. An httpOnly cookie is, by definition, invisible to it.
//
// `proxy.ts` is middleware — it runs on EVERY request and refreshes the session,
// rewriting those cookies with whatever options it is given. So within one
// request of signing in, the browser client could no longer see its own session.
// The symptoms, every one of which was reported and none of which pointed here:
//
//   • "I can never log in on a normal browser — only incognito."
//     Incognito has no poisoned cookie yet; a normal profile keeps one forever.
//   • `/auth/callback` hanging and redirecting with `?auth_error=timeout`.
//     The PKCE **code verifier** is also written and read by the browser client.
//     Once it is httpOnly the exchange cannot complete, `SIGNED_IN` never fires,
//     and the 10-second safety net in `auth/callback/page.tsx` trips.
//   • Clearing site data "fixing" it — until the next request rewrote the cookie.
//   • Server-side reads working perfectly the whole time, which is what made it
//     so confusing: `/api/license/status` returned the user's real `plus` tier
//     and `/api/invoice` returned their invoices, because the SERVER can read
//     httpOnly cookies. Only the browser was blind.
//
// 🔴 **DO NOT ADD `httpOnly` BACK.** It is not a hardening we are choosing to
// forgo; it is incompatible with the client-side session model this app uses.
// `@supabase/ssr` defaults it to false for exactly this reason. If you want
// httpOnly session cookies, that is a different architecture — authentication
// entirely server-side, no `createBrowserClient` session, no
// `onAuthStateChange` — and it is a deliberate multi-day migration, not a
// one-line tightening.
//
// What we keep, because it is free and real:
//   • `secure`   — never send the cookie over plain HTTP in production.
//   • `sameSite: "lax"` — blocks CSRF from cross-site POSTs while still allowing
//     the top-level OAuth redirect back from Google, which `strict` would break.
//
// The XSS risk this leaves is mitigated where it should be: a Content-Security-
// Policy (`next.config.ts`), React's automatic escaping, and keeping
// `dangerouslySetInnerHTML` to JSON-LD and static strings only — never user
// content. Audited 2026-09-30: 15 usages, all schema markup or a static theme
// script.
//
// ── 2. IT WAS DUPLICATED, WITH A COMMENT ASKING FOR MANUAL SYNC. ─────────────
//
// `proxy.ts` carried its own copy and a note saying "Keep both in sync if either
// changes" — because it is Edge middleware and importing `supabaseServer.ts`
// would drag in that module's SUPABASE_SERVICE_ROLE_KEY presence-check.
//
// That constraint is real; the copy-paste answer to it was not. A manual-sync
// instruction is a defect with a delay on it, and this codebase has already paid
// for that pattern once tonight — two drifted copies of "re-read the licence"
// showed a paying subscriber the free tier.
//
// 🔑 So: this file has NO imports and NO side effects. It is safe for Edge
// middleware, for Node server routes, and for anything else. One definition,
// three consumers, nothing to keep in sync.

/**
 * Cookie attributes for every Supabase auth cookie this app writes.
 *
 * ⚠️ `httpOnly` is deliberately absent. See the block above before changing it.
 */
export const SUPABASE_COOKIE_OPTIONS = {
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
};
