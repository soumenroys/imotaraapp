import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

/**
 * 🔴 25 Oct 2026: every settings form on the org dashboard loaded with
 * `.then((r) => r.json())` — no r.ok check — and filled its fields with
 * `?? ""` defaults. A 401/500 therefore rendered as "nothing configured", and
 * pressing Save wrote those blanks OVER the org's real SSO config, allowed
 * domains or data residency. Two of the forms also said "Saved ✓" without
 * looking at the response.
 */
const SRC = fs.readFileSync(path.join(process.cwd(), "src/app/org/dashboard/settings/page.tsx"), "utf8");

const FORMS = [
    { name: "SSO", load: "/api/org/dashboard/sso", button: "Save SSO config" },
    { name: "data residency", load: "/api/org/dashboard/settings", button: '"Save"' },
    { name: "NGO verification", load: "/api/org/dashboard/verification", button: "Submit for verification" },
    { name: "domains", load: "/api/org/dashboard/domain-verify", button: "Save domain settings" },
];

describe("org settings never save over a failed load", () => {
    it("loadSettings answers null on a failed response — it checks r.ok before parsing", () => {
        const fn = SRC.slice(SRC.indexOf("async function loadSettings"), SRC.indexOf("type LoadState"));
        expect(fn).toMatch(/if \(!r\.ok\) return null;/);
        expect(fn).toMatch(/catch \{\s*return null;/);
    });

    it("no form parses a settings response without checking it", () => {
        // The exact shape that caused this.
        expect(SRC).not.toMatch(/\.then\(\(r\) => r\.json\(\)\)\.then/);
    });

    for (const f of FORMS) {
        it(`${f.name}: loads through loadSettings and marks a failure`, () => {
            const at = SRC.indexOf(`loadSettings("${f.load}")`);
            expect(at, `${f.name} must load via loadSettings`).toBeGreaterThan(-1);
            expect(SRC.slice(at, at + 200)).toMatch(/if \(!j\) \{ setLoad\("failed"\); return; \}/);
        });

        it(`${f.name}: its submit button is disabled until the load succeeded`, () => {
            const at = SRC.indexOf(f.button);
            const before = SRC.slice(Math.max(0, at - 400), at);
            expect(before).toMatch(/disabled=\{saving \|\| load !== "ok"\}/);
        });
    }

    it("every save handler refuses to run on a failed load and checks the response", () => {
        const guards = SRC.match(/if \(load !== "ok"\) return;/g) ?? [];
        expect(guards.length).toBe(FORMS.length);
        // "Saved ✓" only inside an r?.ok / r.ok branch — never unconditionally.
        expect(SRC).not.toMatch(/setSaving\(false\); setMsg\("Saved ✓"\);/);
    });

    it("the admin is TOLD the load failed, in red, not shown an empty form", () => {
        expect(SRC).toMatch(/const LOAD_FAILED_MSG = "Couldn't load your current settings/);
        expect(SRC).toMatch(/if \(load === "failed"\) return <p className="text-xs text-rose-400">\{LOAD_FAILED_MSG\}<\/p>;/);
    });
});
