/**
 * Web and mobile must call the licence tiers by exactly the same names — and
 * none of those names may be "Pro".
 *
 * 🔴 WHY THIS EXISTS. Owner, 2026-09-17, after being confused by our own
 * codebase: "do not say pro. only say plus. thats all… i want web and mobile
 * licensing terms exactly same".
 *
 * That confusion was earned. At one point the same tier read "Pro" on the
 * mobile Settings screen and "Premium" in the plan panel; web showed `edu` as
 * "Education" in settings and "EDU" in the badge; and the paid tier's public
 * name was "Plus" while its internal id was `pro`. Three different kinds of
 * drift, all invisible until someone read two screens side by side.
 *
 * ⚠️ AGREED_LABELS below is duplicated in imotara-mobile's copy of this test ON
 * PURPOSE. Two repos cannot import each other, so this pair of literals is the
 * only thing that can catch a rename applied to one side.
 */
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { TIER_LABELS, TIER_ORDER, prettyTier } from "@/types/license";

/** Keep byte-identical with the mobile copy. Values only — ids differ in case. */
const AGREED_LABELS = ["Free", "Plus", "Family", "Education", "Enterprise"];

const SRC = path.join(__dirname, "..");

function walk(dir: string, out: string[] = []): string[] {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) { if (e.name !== "node_modules") walk(p, out); }
        else if (/\.(tsx?|md|json)$/.test(e.name)) out.push(p);
    }
    return out;
}

describe("licensing terms are the same on both platforms", () => {
    it("🔗 the tier labels match mobile's, in order", () => {
        expect(TIER_ORDER.map((t) => TIER_LABELS[t])).toEqual(AGREED_LABELS);
    });

    it("🔴 every id for the paid tier reads 'Plus' — never 'Pro'", () => {
        for (const id of ["plus", "pro", "premium", "PRO", "Premium"]) {
            expect(prettyTier(id), `"${id}" should read Plus`).toBe("Plus");
        }
    });

    it("🔴 no user-visible string calls a plan 'Pro'", () => {
        // Comments may still explain the history — that is how a future reader
        // learns why `pro_*` SKUs exist. Only what ships to a screen counts.
        const offenders: string[] = [];
        for (const f of walk(SRC)) {
            if (f.includes("__tests__")) continue;
            const src = fs
                .readFileSync(f, "utf8")
                .replace(/\/\*[\s\S]*?\*\//g, "")
                .replace(/^[ \t]*\/\/.*$/gm, "")
                .replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
            // "Pro" as a standalone word, not Profile/Product/Proof/…
            if (/\bPro\b(?!\w)/.test(src)) offenders.push(path.relative(SRC, f));
        }
        expect(offenders).toEqual([]);
    });

    it("the paid tier's id matches its name, so the two cannot drift again", () => {
        // The rename that ended the confusion: public "Plus", stored `plus`.
        expect(TIER_ORDER).toContain("plus");
        expect(TIER_LABELS.plus).toBe("Plus");
        expect(TIER_ORDER).not.toContain("pro");
    });
});
