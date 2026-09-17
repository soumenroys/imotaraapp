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
import fs from "fs";
import path from "path";
import { gate, type FeatureKey } from "@/lib/imotara/featureGates";
import { TIER_ORDER, normaliseTier, prettyTier } from "@/types/license";
import { PRODUCT_CATALOG } from "@/lib/imotara/pricing";

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
    it("🔴 the legacy ids grant exactly what `plus` grants", () => {
        // `pro` and `premium` are no longer tiers — they are aliases. A stale
        // value from the database, an in-flight webhook or a phone's cache must
        // land on the paid tier, never fall through to free.
        const on = (t: string) => ALL_KEYS.filter((k) => gate(k, t).enabled);
        expect(on("pro")).toEqual(on("plus"));
        expect(on("premium")).toEqual(on("plus"));
        expect(on("PRO")).toEqual(on("plus"));
        // …and that is not vacuously true because everything is free:
        expect(on("plus").length).toBeGreaterThan(on("free").length);
    });

    it("🔴 the four keys Pro used to hold alone are on plus now", () => {
        for (const k of ["HISTORY_UNLIMITED", "TRENDS_INSIGHTS", "COMPANION_LETTER", "GROWTH_ARC"] as const) {
            expect(gate(k, "plus").enabled, `${k} missing from plus`).toBe(true);
        }
    });

    it("the merged tier grants every key it should, and no more", () => {
        for (const k of MERGED) expect(gate(k, "plus").enabled, `${k} missing`).toBe(true);
        // Institutional keys stay out of the consumer tier.
        for (const k of ["MULTI_PROFILE", "CHILD_SAFE_MODE", "ADMIN_DASHBOARD"] as const) {
            expect(gate(k, "plus").enabled, `${k} leaked into the consumer tier`).toBe(false);
        }
    });

    it("🔴 history is unlimited on plus, and still capped on free", () => {
        // history/page.tsx reads these params on the `off` path too, so this is
        // live behaviour today — not something waiting on enforce mode.
        const days = (t: string) => {
            const r = gate("HISTORY_DAYS_LIMIT", t);
            return r.enabled ? (r.params?.days as number) : -1;
        };
        expect(days("free")).toBe(7);
        expect(days("plus")).toBe(Infinity);
        expect(days("pro")).toBe(Infinity);   // legacy alias
        expect(days("premium")).toBe(Infinity);
    });

    it("free is untouched by the merge", () => {
        const onFree = ALL_KEYS.filter((k) => gate(k, "free").enabled);
        // CLOUD_SYNC plus the always-on day-limit gate. Nothing paid leaked down.
        expect(onFree.sort()).toEqual(["CLOUD_SYNC", "HISTORY_DAYS_LIMIT"]);
    });

    it("🔴 `plus` is the canonical id, and `pro` is no longer a tier", () => {
        // The rename (2026-09-17) made the internal id match the public name.
        // It was a ZERO-ROW migration: the database had no `pro` rows at all.
        expect([...TIER_ORDER]).toEqual(["free", "plus", "family", "edu", "enterprise"]);
        expect([...TIER_ORDER]).not.toContain("pro");
        // But `pro` must still RESOLVE, forever — webhooks, caches and any row
        // written before the rename.
        expect(normaliseTier("pro")).toBe("plus");
        expect(prettyTier("pro")).toBe("Plus");
    });

    it("🔴 every subscription SKU grants the paid tier", () => {
        // The money path. pro_* is what is on sale; plus_* is retired but one
        // Apple subscriber still bills on it and must keep their features.
        for (const id of ["pro_monthly", "pro_annual", "plus_monthly", "plus_annual"] as const) {
            const def = PRODUCT_CATALOG[id];
            expect(def.type).toBe("subscription");
            expect((def as { tier: string }).tier, `${id} grants the wrong tier`).toBe("plus");
        }
    });

    it("🔴 every /upgrade plan card's id IS a real tier id", () => {
        // The upgrade page decides "is this your current plan?" with
        // `currentTier === plan.id`. After the rename the card still said
        // id:"pro" while the resolved tier was "plus", so a paying subscriber
        // saw no "Current plan" badge and was offered a Subscribe button for
        // the plan they were already paying for. Nothing failed — the strings
        // simply stopped matching.
        const upgrade = fs.readFileSync(
            path.join(__dirname, "..", "app", "upgrade", "page.tsx"), "utf8",
        );
        const block = upgrade.slice(0, upgrade.indexOf("const TOKEN_PACKS"));
        const ids = Array.from(block.matchAll(/^\s{8}id:\s*"([a-z_]+)",/gm)).map((m) => m[1]);
        expect(ids.length).toBeGreaterThan(0);
        for (const id of ids) {
            expect(TIER_ORDER as readonly string[], `plan card id "${id}" is not a tier`).toContain(id);
        }
    });
});
