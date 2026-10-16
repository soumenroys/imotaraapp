/**
 * If a kill switch does not cover every door the key opens, it is worse than
 * no kill switch — it reports a thing is off while it is on.
 *
 * 🔴 WHAT WAS FOUND, security review 2026-10-16. `ADMIN_SECRET` is a single
 * static shared secret, 193 days old at the time, present in BOTH the
 * Production and Preview environments, that stands in for a signed-in
 * super-admin. `ADMIN_SECRET_DISABLED=true` exists to retire it. Three helpers
 * accept the key; only TWO honoured the switch:
 *
 *   adminAuthorized()        12 routes   honoured it
 *   connectAdminAuthorized()  8 routes   honoured it
 *   requireSuperAdmin()      19 routes   🔴 DID NOT
 *
 * And requireSuperAdmin is the one its own doc comment tells you to use for any
 * NEW admin route — so it guarded the newest and most sensitive surface,
 * including /admin/users/[userId]/recovery-link, which calls
 * generateLink({ type: "magiclink" }) for an arbitrary userId and returns a
 * link that signs the caller in AS THAT USER.
 *
 * ⚠️ Setting the switch would therefore have produced FALSE ASSURANCE: the
 * owner believes the emergency key is retired while it still opens the single
 * most powerful route in the system. That is the defect — not the existence of
 * an emergency key, which is a deliberate and reasonable choice.
 *
 * ⛔ ASSERTED STRUCTURALLY, over whichever helpers exist, so the next helper
 * that learns to accept the key is caught too. A test naming only these three
 * would go quietly out of date ⇒ trap_a_mirror_test_cannot_catch_a_refactor.
 */

import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const AUTH_FILE = "src/app/api/admin/_auth.ts";
const source = fs.readFileSync(path.join(process.cwd(), AUTH_FILE), "utf8");

/** Each exported function in the admin auth module, with its body. */
function exportedFunctions(src: string): { name: string; body: string }[] {
    const out: { name: string; body: string }[] = [];
    const re = /export\s+(?:async\s+)?function\s+(\w+)/g;
    const starts: { name: string; at: number }[] = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(src))) starts.push({ name: m[1], at: m.index });
    for (let i = 0; i < starts.length; i++) {
        const end = i + 1 < starts.length ? starts[i + 1].at : src.length;
        out.push({ name: starts[i].name, body: src.slice(starts[i].at, end) });
    }
    return out;
}

/** ⚠️ Comments stripped: this module EXPLAINS the defect in prose, and a
 *  comment-reading matcher would credit a function for a mention of the
 *  switch in someone else's documentation. */
const stripComments = (s: string) =>
    s.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");

const FUNCTIONS = exportedFunctions(source).map((f) => ({ ...f, code: stripComments(f.body) }));

const acceptsLegacyKey = (code: string) => /process\.env\.ADMIN_SECRET\b/.test(code);
const honoursSwitch = (code: string) => /ADMIN_SECRET_DISABLED/.test(code);

describe("🔴 the emergency-key kill switch covers every door the key opens", () => {
    it("finds the helpers at all — the parser must not match nothing", () => {
        // ⚠️ The control. A parser that found no functions would make every
        // assertion below pass vacuously.
        expect(FUNCTIONS.length).toBeGreaterThan(2);
        expect(FUNCTIONS.filter((f) => acceptsLegacyKey(f.code)).length).toBeGreaterThan(0);
    });

    it("🔑 EVERY helper that accepts ADMIN_SECRET also honours ADMIN_SECRET_DISABLED", () => {
        const offenders = FUNCTIONS
            .filter((f) => acceptsLegacyKey(f.code) && !honoursSwitch(f.code))
            .map((f) => `${f.name}() accepts the key but ignores the kill switch`);
        expect(offenders).toEqual([]);
    });

    it("⛔ and checks the switch BEFORE reading the secret", () => {
        // Order matters for review: a guard placed after the comparison reads
        // as though the key still works. It also makes the next person's
        // copy-paste put the guard in the right place.
        for (const f of FUNCTIONS.filter((x) => acceptsLegacyKey(x.code) && honoursSwitch(x.code))) {
            const switchAt = f.code.indexOf("ADMIN_SECRET_DISABLED");
            const secretAt = f.code.search(/process\.env\.ADMIN_SECRET\b/);
            expect(switchAt, `${f.name}() reads the secret before checking the switch`)
                .toBeLessThan(secretAt);
        }
    });

    it("🔴 the key is still NOT an owner — it cannot appoint a successor", () => {
        // Established in an earlier round and worth holding: the synthetic
        // identity reports role "admin", so the four owner-gated routes refuse
        // it. If this regressed, possession of an env var would become
        // permanent access that survives rotating that env var.
        expect(source).toMatch(/role:\s*"admin" as const/);
        expect(source).not.toMatch(/role:\s*"owner" as const/);
    });

    it("⛔ /admin offers NO secret-key login box any more", () => {
        // 🔴 The key was never curl-only: /admin had a "Secret key" tab beside
        // the email one. It posted the key to /api/admin/comments and, on 200,
        // stored it in sessionStorage as the session token for every later
        // admin call. So the 194-day-old shared secret was a FRONT-DOOR LOGIN,
        // not just an emergency header.
        //
        // ⚠️ Once ADMIN_SECRET_DISABLED=true was set, that box could never
        // succeed — leaving a login form that silently always fails, the same
        // shape as the mobile crisis-country setting that was written and never
        // read. Removed in code so it cannot come back by an env-var edit.
        const page = fs.readFileSync(
            path.join(process.cwd(), "src/app/admin/page.tsx"), "utf8",
        );
        const code = page.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");
        expect(code, "the Secret key tab is back").not.toMatch(/Secret key/);
        expect(code, "the login mode switcher is back").not.toMatch(/setLoginMode/);
        // ⛔ And nothing on that page may send a Bearer to the comments route,
        // which is how the box authenticated.
        expect(code).not.toMatch(/admin\/comments["'`][\s\S]{0,160}Authorization/);
    });

    it("✅ and the page points a locked-out admin at the reset flow instead", () => {
        // The old footer said "Set ADMIN_SECRET in .env.local" — advice that
        // would now send someone chasing a key that is switched off and has no
        // login box. A dead instruction is worse than none.
        const page = fs.readFileSync(
            path.join(process.cwd(), "src/app/admin/page.tsx"), "utf8",
        );
        const code = page.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");
        expect(code).not.toMatch(/Set <code[^>]*>ADMIN_SECRET/);
        expect(code).toMatch(/Forgot password\?/);
    });

    it("⚠️ nothing in the codebase DEPENDS on the legacy Bearer path", () => {
        // Which is why the switch is safe to turn on. Crons authenticate with
        // CRON_SECRET; no script and nothing in imotara-mobile sends this key.
        // If a caller ever appears, flipping the switch would break it, and
        // this assertion is where that gets noticed.
        const callers: string[] = [];
        const walk = (dir: string) => {
            for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
                const p = path.join(dir, e.name);
                if (e.isDirectory()) { walk(p); continue; }
                if (!/\.(ts|tsx|mjs|js)$/.test(e.name)) continue;
                const rel = path.relative(process.cwd(), p);
                if (rel === AUTH_FILE || rel.includes("__tests__")) continue;
                const text = fs.readFileSync(p, "utf8");
                // A CALL sends the header; a route merely mentions it in a comment.
                if (/Bearer\s+\$\{?\s*(process\.env\.)?ADMIN_SECRET/.test(text)) callers.push(rel);
            }
        };
        walk(path.join(process.cwd(), "src"));
        if (fs.existsSync(path.join(process.cwd(), "scripts"))) {
            walk(path.join(process.cwd(), "scripts"));
        }
        expect(callers).toEqual([]);
    });
});
