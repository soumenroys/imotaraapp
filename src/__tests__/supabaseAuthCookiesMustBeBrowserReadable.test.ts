/**
 * Supabase auth cookies must stay readable by JavaScript. Never add httpOnly.
 *
 * 🔴 WHY THIS EXISTS. `SECURE_COOKIE_OPTIONS` carried `httpOnly: true`, added in
 * good faith to stop an XSS reading the session out of `document.cookie`. It
 * broke signing in completely, for months, and nothing pointed at it:
 *
 *   `@supabase/ssr`'s BROWSER client stores and reads the session THROUGH
 *   `document.cookie`. An httpOnly cookie is invisible to it by definition.
 *
 * `proxy.ts` is middleware — it runs on EVERY request and rewrites the session
 * cookies with whatever options it is handed. So within one request of signing
 * in, the browser client could no longer see its own session.
 *
 * What that looked like from outside, none of which implicated cookie flags:
 *   • "I can never log in on a normal browser — only incognito."
 *   • /auth/callback hanging, then `?auth_error=timeout`: the PKCE code verifier
 *     is ALSO written and read by the browser client, so the exchange could
 *     never complete and the 10s safety net tripped every time.
 *   • Clearing site data appearing to fix it, until the next request.
 *   • Server-side reads working perfectly throughout — /api/license/status
 *     returned the user's real `plus` tier while the UI said Free — because the
 *     SERVER can read httpOnly cookies. Only the browser was blind.
 *
 * ⚠️ This is NOT a hardening we chose to skip. It is incompatible with the
 * client-side session model this app uses, which is why @supabase/ssr defaults
 * it to false. Wanting httpOnly session cookies means moving authentication
 * fully server-side — no createBrowserClient session, no onAuthStateChange —
 * a deliberate migration, not a one-line tightening. If that day comes, delete
 * this file in the same commit, on purpose.
 *
 * The XSS risk is mitigated where it belongs: CSP in next.config.ts, React's
 * automatic escaping, and dangerouslySetInnerHTML restricted to JSON-LD and
 * static strings (audited 2026-09-30: 15 usages, zero user content).
 */
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const read = (...p: string[]) =>
    fs.readFileSync(path.join(__dirname, "..", ...p), "utf8");

const OPTIONS = read("lib", "supabase", "cookieOptions.ts");
const PROXY = read("proxy.ts");
const SERVER = read("lib", "supabaseServer.ts");
const USER_SERVER = read("lib", "supabase", "userServer.ts");

/** Strip comments so prose about httpOnly does not trip the assertions. */
const code = (src: string) =>
    src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");

describe("🔴 Supabase auth cookies must remain readable by document.cookie", () => {
    it("the shared options do NOT set httpOnly", () => {
        expect(code(OPTIONS)).not.toMatch(/httpOnly/);
    });

    it("no consumer sneaks httpOnly back in", () => {
        for (const src of [PROXY, SERVER, USER_SERVER]) {
            expect(code(src)).not.toMatch(/httpOnly/);
        }
    });

    it("🔑 keeps the attributes that ARE worth having", () => {
        // secure: never send over plain HTTP in production.
        // sameSite lax: blocks cross-site POST CSRF while still allowing the
        // top-level OAuth redirect back from Google, which `strict` would break.
        expect(OPTIONS).toMatch(/secure:\s*process\.env\.NODE_ENV === "production"/);
        expect(OPTIONS).toMatch(/sameSite:\s*"lax"/);
    });

    it("sameSite is NOT strict — that would break the OAuth return", () => {
        expect(code(OPTIONS)).not.toMatch(/sameSite:\s*"strict"/);
    });
});

describe("🔑 one definition, not a copy with a sync instruction", () => {
    it("middleware imports the shared options instead of redeclaring them", () => {
        // proxy.ts used to hold its own copy under a comment reading
        // "Keep both in sync if either changes". A manual-sync instruction is a
        // defect with a delay on it — the same pattern that let two copies of
        // "re-read the licence" drift and show a paying subscriber the free tier.
        expect(PROXY).toMatch(/from "@\/lib\/supabase\/cookieOptions"/);
        expect(code(PROXY)).not.toMatch(/const SECURE_COOKIE_OPTIONS\s*=\s*\{/);
        expect(code(PROXY)).not.toMatch(/const SUPABASE_COOKIE_OPTIONS\s*=\s*\{/);
    });

    it("every server client uses those same options", () => {
        for (const src of [PROXY, SERVER, USER_SERVER]) {
            expect(src).toMatch(/cookieOptions:\s*SUPABASE_COOKIE_OPTIONS/);
        }
    });

    it("🔑 the options module stays import-free so Edge middleware can use it", () => {
        // proxy.ts is Edge middleware. The original copy-paste existed because
        // importing supabaseServer.ts drags in its SUPABASE_SERVICE_ROLE_KEY
        // presence-check at module load. Keeping this file dependency-free is
        // what makes one shared definition possible at all.
        expect(code(OPTIONS)).not.toMatch(/^\s*import\s/m);
    });

    it("the old export name still resolves, so existing imports keep working", () => {
        expect(SERVER).toMatch(/SUPABASE_COOKIE_OPTIONS as SECURE_COOKIE_OPTIONS/);
    });
});

describe("the ADMIN session cookie is a different system and keeps httpOnly", () => {
    it("admin login still sets httpOnly", () => {
        // Separate, server-only auth — no browser client ever reads it, so
        // httpOnly is correct there. Removing it would be a real regression.
        const adminLogin = read("app", "api", "admin", "auth", "login", "route.ts");
        expect(code(adminLogin)).toMatch(/httpOnly:\s*true/);
    });
});
