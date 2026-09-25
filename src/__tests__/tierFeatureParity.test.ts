/**
 * What each tier grants is the SAME on web and mobile.
 *
 * 🔴 WHY THIS EXISTS. `TIER_FEATURES` here and `ALL` in imotara-mobile's
 * `src/licensing/featureGates.ts` are two hand-maintained copies of the same
 * table. They were verified identical on 2026-09-25 — and NOTHING held them
 * that way. `licensingTermsMatchMobile.test.ts` pins the tier LABELS; the
 * feature sets had no guard at all. Web could grant EXPORT_DATA to `edu` and
 * mobile not, and every test in both repos would still pass.
 *
 * 🔑 That is precisely the drift that made FAMILY LICENCES UNISSUABLE (L1):
 * "two lists that happen to agree". Prices got a cross-repo pin
 * (pricingCatalog.test.ts); features never did.
 *
 * ⚠️ AGREED_FEATURES below is duplicated in imotara-mobile's copy of this test
 * ON PURPOSE. Two repos cannot import each other, so that duplicated literal is
 * the only thing that catches a change applied to one side alone. Edit both, in
 * the same pass, in the same release.
 *
 * ⏰ This is LATENT while nothing is enforced (LICENSE_MODE="off",
 * SOFT_LAUNCH_BYPASS_ALL_GATES=true). The day enforcement flips, any drift
 * becomes a user-visible difference between platforms — someone paying the same
 * money getting different features on their phone and their laptop.
 */
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { TIER_ORDER } from "@/types/license";
import { featuresForTier, historyDaysForTier } from "@/lib/imotara/featureGates";

/**
 * ⚠️ DUPLICATED IN imotara-mobile/src/__tests__/tierFeatureParity.test.ts.
 * Keys are the WEB spellings; mobile's copy uppercases them.
 */
const AGREED_FEATURES: Record<string, readonly string[]> = {
    free: ["CLOUD_SYNC"],
    plus: [
        "CLOUD_SYNC", "HISTORY_UNLIMITED", "TRENDS_INSIGHTS", "EXPORT_DATA",
        "TTS_ADVANCED", "SEARCH_MODE", "REPLY_CADENCE",
        "COMPANION_LETTER", "GROWTH_ARC",
    ],
    family: [
        "CLOUD_SYNC", "HISTORY_UNLIMITED", "TRENDS_INSIGHTS",
        "MULTI_PROFILE", "CHILD_SAFE_MODE", "TTS_ADVANCED", "SEARCH_MODE",
        "REPLY_CADENCE", "COMPANION_LETTER", "GROWTH_ARC",
    ],
    edu: [
        "CLOUD_SYNC", "HISTORY_UNLIMITED", "TRENDS_INSIGHTS", "ADMIN_DASHBOARD",
        "CHILD_SAFE_MODE", "TTS_ADVANCED", "SEARCH_MODE", "REPLY_CADENCE",
    ],
    enterprise: [
        "CLOUD_SYNC", "HISTORY_UNLIMITED", "TRENDS_INSIGHTS", "EXPORT_DATA",
        "ADMIN_DASHBOARD", "CHILD_SAFE_MODE", "MULTI_PROFILE", "TTS_ADVANCED",
        "SEARCH_MODE", "REPLY_CADENCE", "COMPANION_LETTER", "GROWTH_ARC",
    ],
};

/** ⚠️ Also duplicated in mobile's copy. Infinity is written as -1 there too. */
const AGREED_HISTORY_DAYS: Record<string, number> = {
    free: 7, plus: Infinity, family: Infinity, edu: Infinity, enterprise: Infinity,
};

describe("🔴 tier → features matches mobile", () => {
    it.each(TIER_ORDER.map((t) => [t] as const))("%s grants exactly the agreed set", (tier) => {
        expect([...featuresForTier(tier)].sort()).toEqual([...AGREED_FEATURES[tier]].sort());
    });

    it("every tier in TIER_ORDER is covered — a new tier cannot slip through unpinned", () => {
        expect(Object.keys(AGREED_FEATURES).sort()).toEqual([...TIER_ORDER].sort());
    });
});

describe("🔴 history retention matches mobile", () => {
    it.each(TIER_ORDER.map((t) => [t] as const))("%s", (tier) => {
        expect(historyDaysForTier(tier)).toBe(AGREED_HISTORY_DAYS[tier]);
    });
});

describe("the invariants behind the table", () => {
    it("free grants CLOUD_SYNC and nothing else", () => {
        // Cloud sync is free by deliberate decision (the launch flag
        // LAUNCH_CLOUD_SYNC_FREE_FOR_ALL). Everything else is paid.
        expect([...featuresForTier("free")]).toEqual(["CLOUD_SYNC"]);
    });

    it("every paid tier is a strict superset of free", () => {
        const free = featuresForTier("free");
        for (const tier of TIER_ORDER.filter((t) => t !== "free")) {
            for (const f of free) {
                expect([...featuresForTier(tier)], `${tier} lost ${f}`).toContain(f);
            }
        }
    });

    it("🔑 ADMIN_DASHBOARD belongs to institutions only", () => {
        // A consumer tier gaining it would expose org tooling to individuals.
        for (const tier of ["free", "plus", "family"] as const) {
            expect([...featuresForTier(tier)]).not.toContain("ADMIN_DASHBOARD");
        }
        for (const tier of ["edu", "enterprise"] as const) {
            expect([...featuresForTier(tier)]).toContain("ADMIN_DASHBOARD");
        }
    });

    it("🔑 EXPORT_DATA is off for family and edu, on purpose", () => {
        // Family = shared device, a privacy boundary. EDU exports in bulk and
        // anonymised via the admin panel, not per individual.
        expect([...featuresForTier("family")]).not.toContain("EXPORT_DATA");
        expect([...featuresForTier("edu")]).not.toContain("EXPORT_DATA");
    });
});


/**
 * 🔑 THE ACTUAL CROSS-REPO CHECK — and why the convention alone is not enough.
 *
 * The existing price pin (pricingCatalog.test.ts) duplicates its literal in both
 * repos with a comment saying "change both". That catches *changing the source
 * and forgetting the literal* — inside one repo. It does NOT catch changing the
 * source AND the literal in one repo and never touching the other. Nothing
 * compares the two copies.
 *
 * Both repos are checked out side by side, so here the comparison is real: this
 * reads mobile's copy of AGREED_FEATURES and diffs it against this one. Tier
 * names are normalised (web lowercase ↔ mobile uppercase).
 *
 * ⚠️ It SKIPS when the sibling repo is absent — CI checks out one repo — and
 * says so loudly rather than passing silently. A skipped guard that looks green
 * is worse than no guard.
 */
const MOBILE_TEST = path.join(
    __dirname, "..", "..", "..", "imotara-mobile", "src", "__tests__", "tierFeatureParity.test.ts",
);

/** Pull `TIER: ["A", "B"]` blocks out of the other repo's AGREED_FEATURES. */
function parseAgreed(src: string): Record<string, string[]> {
    const block = /const AGREED_FEATURES[^=]*=\s*\{([\s\S]*?)\n\};/.exec(src);
    if (!block) throw new Error("AGREED_FEATURES not found in the sibling test");
    const out: Record<string, string[]> = {};
    for (const m of block[1].matchAll(/(\w+):\s*\[([\s\S]*?)\]/g)) {
        out[m[1].toLowerCase()] = [...m[2].matchAll(/"([A-Z_]+)"/g)].map((x) => x[1]).sort();
    }
    return out;
}

describe("🔴 the two repos' agreed maps are IDENTICAL", () => {
    const present = fs.existsSync(MOBILE_TEST);

    it(present ? "mobile's copy matches this one" : "SKIPPED — sibling repo not checked out", () => {
        if (!present) {
            console.warn(
                `[tierFeatureParity] ⚠️ SKIPPED the cross-repo diff: ${MOBILE_TEST} not found. ` +
                "This guard only has teeth when both repos are checked out side by side.",
            );
            expect(present).toBe(false); // explicit, so the skip is visible
            return;
        }
        const theirs = parseAgreed(fs.readFileSync(MOBILE_TEST, "utf8"));
        const ours = Object.fromEntries(
            Object.entries(AGREED_FEATURES).map(([k, v]) => [k.toLowerCase(), [...v].sort()]),
        );
        expect(theirs).toEqual(ours);
    });
});
