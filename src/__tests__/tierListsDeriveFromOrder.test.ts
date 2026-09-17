/**
 * Every tier enumeration must derive from TIER_ORDER.
 *
 * 🔴 WHY THIS EXISTS. On 2026-09-17 seven separate hardcoded tier lists were
 * found in this repo, and FOUR of them silently omitted "family". That was not
 * cosmetic. The org license-pool API validated incoming tiers against one of
 * the short lists, so issuing a Family pool was rejected with
 *
 *     tier must be one of: free, plus, pro, edu, enterprise
 *
 * — a tier the product sells, unreachable through its own admin panel. Two
 * admin dropdowns and an org filter had lost it the same way, and the mobile
 * repo carried five more copies of its own list.
 *
 * Hand-copying the list is how that happened. This test makes the copy fail.
 */
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { TIER_ORDER, TIER_RANK, TIER_LABELS, isLicenseTier, byTier, prettyTier } from "@/types/license";

const SRC = path.join(__dirname, "..");
const CANONICAL = path.join(SRC, "types", "license.ts");

function walk(dir: string, out: string[] = []): string[] {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) { if (e.name !== "node_modules") walk(p, out); }
        else if (/\.tsx?$/.test(e.name)) out.push(p);
    }
    return out;
}

describe("TIER_ORDER is the only tier list", () => {
    const files = walk(SRC).filter(
        (f) => f !== CANONICAL && !f.includes("__tests__") && !/\.test\.tsx?$/.test(f),
    );

    it("🔴 no file re-types the tier union", () => {
        // The union appeared verbatim in BOTH types/license.ts and
        // lib/imotara/license.ts — two copies that could disagree.
        //
        // ⚠️ The needle requires "enterprise", not just "pro". The tutorial page
        // has `key as "free" | "plus" | "pro" | "ent"`, which looks similar but
        // is a different axis: those are the four COLUMNS of the comparison
        // table, not the six licence tiers. A looser needle flagged it, and
        // "fixing" it would have coupled table layout to the tier list.
        const offenders = files.filter((f) =>
            /"free"\s*\|(?:[^;\n]*\|)?\s*"enterprise"/.test(fs.readFileSync(f, "utf8")),
        );
        expect(offenders.map((f) => path.relative(SRC, f))).toEqual([]);
    });

    it("🔴 no file hand-writes an array of tier names", () => {
        // Matches a bracketed list mentioning both ends of the range. The
        // per-feature `{ free: …, plus: …, pro: …, ent: … }` maps on the
        // tutorial and upgrade pages use "ent", not "enterprise", so they are
        // correctly untouched by this.
        const offenders = files.filter((f) => {
            const src = fs.readFileSync(f, "utf8");
            return /\[[^\]]*"free"[^\]]*"enterprise"[^\]]*\]/s.test(src);
        });
        expect(offenders.map((f) => path.relative(SRC, f))).toEqual([]);
    });

    it("carries every tier the product actually sells", () => {
        // family is the one that went missing; enterprise/edu are sold too.
        expect([...TIER_ORDER]).toEqual(["free", "plus", "pro", "family", "edu", "enterprise"]);
        expect(TIER_ORDER).toContain("family");
    });

    it("TIER_RANK is derived, so it cannot drift from TIER_ORDER", () => {
        expect(Object.keys(TIER_RANK)).toEqual([...TIER_ORDER]);
        TIER_ORDER.forEach((t, i) => expect(TIER_RANK[t]).toBe(i));
    });

    it("isLicenseTier accepts every real tier and rejects the rest", () => {
        for (const t of TIER_ORDER) expect(isLicenseTier(t)).toBe(true);
        for (const bad of ["premium", "FREE", "", null, undefined, 3, {}])
            expect(isLicenseTier(bad)).toBe(false);
    });

    it("byTier falls back instead of rendering undefined into a className", () => {
        const map = Object.fromEntries(TIER_ORDER.map((t) => [t, `c-${t}`])) as Record<
            (typeof TIER_ORDER)[number], string
        >;
        expect(byTier(map, "family", "fallback")).toBe("c-family");
        expect(byTier(map, "nonsense", "fallback")).toBe("fallback");
        expect(byTier(map, null, "fallback")).toBe("fallback");
    });

    it("🔴 no file hand-writes a second tier LABEL map", () => {
        // Two existed and disagreed: settings/page.tsx said "Education",
        // LicenseBadge.tsx said "EDU", for the same tier.
        //
        // ⚠️ The needle matches the MAP SHAPE (`free: "Free"` … `enterprise:
        // "Enterprise"`), not just the words. A looser version flagged the
        // tutorial page's pricing cards — hand-written marketing copy that is
        // meant to be prose — and settings/page.tsx's `tierLabel === "Free"`
        // comparisons, which are a different problem (see prettyTier's note on
        // branching behaviour off a label; that is L14's to fix).
        const offenders = files.filter((f) => {
            const src = fs.readFileSync(f, "utf8");
            return /free:\s*"Free"[\s\S]{0,300}enterprise:\s*"Enterprise"/.test(src);
        });
        expect(offenders.map((f) => path.relative(SRC, f))).toEqual([]);
    });

    it("every tier has a label, and the aliases still resolve", () => {
        for (const t of TIER_ORDER) expect(TIER_LABELS[t]).toBeTruthy();
        expect(prettyTier("edu")).toBe("Education");
        // Mobile spellings reaching the web — settings/page.tsx tolerated these
        // before the refactor and must continue to.
        // 🔗 Since L10 the merged tier reads "Plus" whichever id it arrives as —
        // `pro`, the mobile spelling `premium`, or the legacy `plus`. They are
        // one plan, so one label; "Pro" would name a plan we no longer sell.
        expect(prettyTier("pro")).toBe("Plus");
        expect(prettyTier("plus")).toBe("Plus");
        expect(prettyTier("premium")).toBe("Plus");
        expect(prettyTier("PRO")).toBe("Plus");
        expect(prettyTier("education")).toBe("Education");
        expect(prettyTier(null)).toBe("Free");
        expect(prettyTier("nonsense")).toBe("Free");
    });
});
