/**
 * Plus and Pro are ONE tier. Nothing may quietly un-merge them.
 *
 * 🔴 WHY THIS EXISTS. Before L10 the two tiers listed their features
 * separately, and `plus` was missing four keys that `pro` had:
 * HISTORY_UNLIMITED, TRENDS_INSIGHTS, COMPANION_LETTER, GROWTH_ARC. The merge
 * makes them identical — but two lists that happen to agree is precisely the
 * pattern that left "family" out of four of seven tier lists and made Family
 * licences unissuable. Both tiers now read one array; this pins that.
 *
 * ⚠️ `plus` is kept as the LEGACY id, not deleted. One ₹99 subscriber is still
 * on it, and the licences table has rows carrying it. They get the merged
 * tier's features at their old price — that is what grandfathering means here.
 *
 * ⚠️ MOBILE HAS ITS OWN COPY. imotara-mobile's featureGates.ts mirrors this,
 * and its tierMergeIsComplete.test.ts pins the same nine keys. Change both.
 */
import { describe, it, expect } from "vitest";
import { gate, type FeatureKey } from "@/lib/imotara/featureGates";
import { TIER_ORDER } from "@/types/license";

/** The merged paid tier's features. Duplicated in the mobile test on purpose. */
const MERGED = [
    "CLOUD_SYNC", "HISTORY_UNLIMITED", "TRENDS_INSIGHTS", "EXPORT_DATA",
    "TTS_ADVANCED", "SEARCH_MODE", "REPLY_CADENCE", "COMPANION_LETTER", "GROWTH_ARC",
] as const;

/** Every key, so "enabled on plus" can be compared to "enabled on pro" exhaustively. */
const ALL_KEYS: FeatureKey[] = [
    "CLOUD_SYNC", "HISTORY_UNLIMITED", "HISTORY_DAYS_LIMIT", "TRENDS_INSIGHTS",
    "EXPORT_DATA", "MULTI_PROFILE", "CHILD_SAFE_MODE", "ADMIN_DASHBOARD",
    "TTS_ADVANCED", "SEARCH_MODE", "REPLY_CADENCE", "COMPANION_LETTER", "GROWTH_ARC",
];

describe("the Plus/Pro merge", () => {
    it("🔴 plus and pro grant exactly the same features", () => {
        const onPlus = ALL_KEYS.filter((k) => gate(k, "plus").enabled);
        const onPro  = ALL_KEYS.filter((k) => gate(k, "pro").enabled);
        expect(onPlus).toEqual(onPro);
    });

    it("🔴 the four keys Pro used to hold alone are on plus now", () => {
        for (const k of ["HISTORY_UNLIMITED", "TRENDS_INSIGHTS", "COMPANION_LETTER", "GROWTH_ARC"] as const) {
            expect(gate(k, "plus").enabled, `${k} missing from plus`).toBe(true);
        }
    });

    it("the merged tier grants every key it should, and no more", () => {
        for (const k of MERGED) expect(gate(k, "pro").enabled, `${k} missing`).toBe(true);
        // Institutional keys stay out of the consumer tier.
        for (const k of ["MULTI_PROFILE", "CHILD_SAFE_MODE", "ADMIN_DASHBOARD"] as const) {
            expect(gate(k, "pro").enabled, `${k} leaked into the consumer tier`).toBe(false);
        }
    });

    it("🔴 history is unlimited on plus, and still capped on free", () => {
        // history/page.tsx reads these params on the `off` path too, so this is
        // live behaviour today — not something waiting on enforce mode.
        const days = (t: "free" | "plus" | "pro") => {
            const r = gate("HISTORY_DAYS_LIMIT", t);
            return r.enabled ? (r.params?.days as number) : -1;
        };
        expect(days("free")).toBe(7);
        expect(days("plus")).toBe(Infinity);
        expect(days("pro")).toBe(Infinity);
    });

    it("free is untouched by the merge", () => {
        const onFree = ALL_KEYS.filter((k) => gate(k, "free").enabled);
        // CLOUD_SYNC plus the always-on day-limit gate. Nothing paid leaked down.
        expect(onFree.sort()).toEqual(["CLOUD_SYNC", "HISTORY_DAYS_LIMIT"]);
    });

    it("🔴 L11 — `plus` must NOT be deleted, merged though it is", () => {
        // The temptation after a merge is to delete the redundant tier. Do not.
        //   · the licences table has rows carrying tier='plus'
        //   · one subscriber is live on plus_monthly at ₹99, grandfathered
        //   · the mobile app has "PLUS" written into AsyncStorage on devices
        // Deleting it would resolve all of them to `free` — a paying customer
        // silently losing everything they pay for.
        expect([...TIER_ORDER]).toContain("plus");
        expect(gate("HISTORY_UNLIMITED", "plus").enabled).toBe(true);
        // And `pro` stays the internal id even though the public name is "Plus".
        expect([...TIER_ORDER]).toContain("pro");
    });
});
