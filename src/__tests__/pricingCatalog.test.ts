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
    plus_monthly:  9_900,
    plus_annual:   69_900,
    pro_monthly:   14_900,
    pro_annual:    129_900,
    tokens_100:    4_900,
    tokens_250:    9_900,
    tokens_600:    19_900,
    tokens_1800:   49_900,
} as const;

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

    it("🔴 the tutorial page advertises the prices we actually charge", () => {
        // tutorial/page.tsx writes prices as prose ("₹149/mo"). Prose is fine;
        // a WRONG number is not. This is the guard that catches a Stage C
        // reprice that updates the catalog and forgets the tutorial.
        const tutorial = read("src/app/tutorial/page.tsx");
        const plusMo = inr(paiseFor("plus_monthly"));   // ₹99
        const proMo  = inr(paiseFor("pro_monthly"));    // ₹149
        const proYr  = inr(paiseFor("pro_annual"));     // ₹1,299
        expect(tutorial).toContain(`${plusMo}/mo`);
        expect(tutorial).toContain(`${proMo}/mo`);
        // The annual figure appears with and without the thousands comma.
        expect(tutorial.includes(proYr) || tutorial.includes(proYr.replace(",", ""))).toBe(true);
    });

    it("🔴 the admin guide quotes the same prices support will be asked about", () => {
        const guide = read("src/app/admin/guide/page.tsx");
        expect(guide).toContain(inr(paiseFor("plus_monthly")));
        expect(guide).toContain(inr(paiseFor("pro_monthly")));
    });
});
