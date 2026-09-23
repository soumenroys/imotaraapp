/**
 * Prices are written once and read everywhere.
 *
 * 🔴 WHY THIS EXISTS. The same amounts were hand-typed in the catalog, on
 * /upgrade, on the tutorial page, in the admin guide, in the audience pages and
 * across 23 files of docs and KB content. They drifted — licensing_strategy
 * carried "Plus ₹79" for months after the real price became ₹99. Stage C
 * reprices the merged tier, so every surviving copy is a chance to publish a
 * number we do not charge.
 *
 * ⚠️ MOBILE HAS A SECOND COPY. imotara-mobile's `src/payments/upgradePlans.ts`
 * (PLAN_DEFS) carries the same amounts, and its own pricingCatalog.test.ts pins
 * them to the identical literals below. Two repos cannot import each other, so
 * this pair of tests is the seam: change one side alone and the other fails.
 *
 * 🔴 That matters more on Android than anywhere else — UpgradeSheet renders
 * PLAN_DEFS directly instead of asking Play Console (iOS reads the store). A
 * console reprice without a matching mobile release shows one price and charges
 * another.
 */
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { PRODUCT_CATALOG, paiseFor, inr } from "@/lib/imotara/pricing";

const ROOT = path.join(__dirname, "..", "..");
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), "utf8");

/**
 * ⚠️ These literals are duplicated in imotara-mobile/src/__tests__/pricingCatalog.test.ts
 * ON PURPOSE. They are the contract between the two repos. Change both, in the
 * same pass, in the same release — see the Release coordination decision.
 */
const AGREED_PAISE = {
    // 🔄 FLIPPED 2026-09-25 — `plus_*` is the LIVE pair, `pro_*` retired.
    // Both pairs now carry the SAME amounts: the merged tier has one price, and
    // a retired SKU that somehow resolves must grant at that price, not an old one.
    plus_monthly:  14_900,
    plus_annual:   129_900,
    pro_monthly:   14_900,
    pro_annual:    129_900,
    tokens_100:    4_900,
    tokens_250:    9_900,
    tokens_600:    19_900,
    tokens_1800:   49_900,
} as const;

describe("which pair /upgrade actually sells", () => {
    // 🔴 WHY THIS EXISTS. The live and retired pairs were SWAPPED on 2026-09-25:
    // `plus_*` became the pair on sale, `pro_*` retired. PRODUCT_CATALOG carries
    // no `retired` flag — only a comment — so on web the ONLY evidence of which
    // pair is live is what /upgrade puts in its checkout call. Nothing asserted
    // that, which meant a silent re-flip was possible.
    //
    // This is not cosmetic: Play sells `plus_monthly`/`plus_annual` and nothing
    // else, and mobile's PLAN_DEFS is pinned to the same ids. If web sold
    // `pro_*` again, the two platforms would be selling different SKUs for the
    // same plan, and `payment_licenses` would record both.

    it("the checkout uses the LIVE plus_* ids", () => {
        const upgrade = read("src/app/upgrade/page.tsx");
        expect(upgrade).toMatch(/monthlyId:\s*"plus_monthly"/);
        expect(upgrade).toMatch(/annualId:\s*"plus_annual"/);
    });

    it("it does not sell the retired pro_* ids", () => {
        const upgrade = read("src/app/upgrade/page.tsx")
            .replace(/\/\*[\s\S]*?\*\//g, "")
            .replace(/^[ \t]*\/\/.*$/gm, "");
        expect(upgrade).not.toMatch(/(monthlyId|annualId):\s*"pro_/);
    });

    it("both pairs carry the same price — one merged tier, one price", () => {
        // A retired SKU that somehow resolves (in-flight purchase, restore)
        // must grant at the current price, not a pre-merge one.
        expect(paiseFor("pro_monthly")).toBe(paiseFor("plus_monthly"));
        expect(paiseFor("pro_annual")).toBe(paiseFor("plus_annual"));
    });
});

describe("the price list", () => {
    it("🔴 matches the amounts mobile also ships", () => {
        for (const [id, paise] of Object.entries(AGREED_PAISE)) {
            expect(paiseFor(id as keyof typeof AGREED_PAISE)).toBe(paise);
        }
    });

    it("covers every product and prices them all in whole rupees", () => {
        expect(Object.keys(PRODUCT_CATALOG).sort()).toEqual(Object.keys(AGREED_PAISE).sort());
        for (const id of Object.keys(PRODUCT_CATALOG)) {
            const p = paiseFor(id as keyof typeof AGREED_PAISE);
            expect(p % 100).toBe(0);
        }
    });

    it("formats paise the way the UI shows them", () => {
        expect(inr(9_900)).toBe("₹99");
        expect(inr(129_900)).toBe("₹1,299");
    });

    it("🔴 /upgrade no longer hardcodes an amount", () => {
        // It used to carry monthlyPaise/annualPaise literals and token labels.
        const upgrade = read("src/app/upgrade/page.tsx");
        expect(upgrade).toMatch(/paiseFor\(/);
        // `[1-9]` on purpose: the Free plan is legitimately `monthlyPaise: 0`
        // and has no catalog entry to derive from.
        expect(upgrade).not.toMatch(/(monthly|annual)Paise:\s*[1-9]/);
    });

    it("🔴 the tutorial advertises the merged plan's price, and only that", () => {
        // tutorial/page.tsx writes prices as prose ("₹149/mo"). Prose is fine;
        // a WRONG number is not. This catches a reprice that updates the
        // catalog and forgets the tutorial.
        const tutorial = read("src/app/tutorial/page.tsx");
        const mergedMo = inr(paiseFor("plus_monthly"));  // ₹149 — "Imotara Plus"
        const mergedYr = inr(paiseFor("plus_annual"));   // ₹1,299
        expect(tutorial).toContain(`${mergedMo}/mo`);
        // The annual figure appears with and without the thousands comma.
        expect(tutorial.includes(mergedYr) || tutorial.includes(mergedYr.replace(",", ""))).toBe(true);

        // 🔴 And it must NOT still advertise the PRE-MERGE prices. These are
        // literals on purpose: ₹99/₹699 no longer exist anywhere in
        // PRODUCT_CATALOG (the 2026-09-25 flip gave `plus_*` the merged ₹149 /
        // ₹1,299), so they cannot be derived from paiseFor any more — and stale
        // pre-merge copy is exactly what this guards against.
        // ₹99 alone is fine: that is the tokens_250 pack. The needle is the
        // "/mo" that makes it a plan price.
        expect(tutorial).not.toContain("₹99/mo");
        expect(tutorial).not.toContain("₹699");
        expect(tutorial).not.toMatch(/\bPro [Pp]lan\b/);
    });

    it("🔴 the admin guide quotes the price support will be asked about", () => {
        // Support reads this table to answer "what do I get for what?". After
        // the merge it is one paid consumer row, not two.
        const guide = read("src/app/admin/guide/page.tsx");
        expect(guide).toContain(inr(paiseFor("plus_monthly")));
        expect(guide).toContain(inr(paiseFor("plus_annual")));
        // The PRE-MERGE price must not still be quoted as current. Literal, for
        // the same reason as above — ₹99/mo is no longer any SKU's price.
        expect(guide).not.toContain("₹99/mo");
    });
});
