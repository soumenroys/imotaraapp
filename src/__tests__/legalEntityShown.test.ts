/**
 * The website must NAME the operating entity, on every page.
 *
 * 🔴 WHY THIS EXISTS. BillDesk rejected Google Play PA-CB application
 * 2609171402 on 2026-09-21 with, among five clarifications: "Web Application
 * has a missing/incomplete legal name of the Entity."
 *
 * They were right — `M/S IMOTARA` appeared on /contact and nowhere else. A
 * payment aggregator verifies that the site it is enabling payments for
 * visibly names the applicant company, and one page out of a whole site does
 * not read as "this entity operates this site". The fix put it in the footer,
 * which renders everywhere.
 *
 * ⚠️ AGREED_* is duplicated in imotara-mobile's copy of this test ON PURPOSE.
 * Two repos cannot import each other, so this pair of literals is the only
 * thing that catches a change applied to one side. Same pattern as
 * `licensingTermsMatchMobile.test.ts` and `pricingCatalog.test.ts`.
 */
import fs from "fs";
import path from "path";
import { describe, it, expect } from "vitest";
import { BUSINESS, formattedAddress } from "@/lib/imotara/businessIdentity";

/** Keep byte-identical with the mobile copy. This is what KYC filings carry. */
const AGREED_LEGAL_NAME = "M/S IMOTARA";
const AGREED_EMAIL      = "info@imotara.com";
const AGREED_POSTCODE   = "700008";

const SRC    = path.join(process.cwd(), "src");
const FOOTER = path.join(SRC, "components", "SiteFooter.tsx");
const read   = (p: string) => fs.readFileSync(p, "utf8");

describe("the legal entity constant matches the mobile repo", () => {
    it("legal name has not drifted", () => {
        // No full stop: the deed writes "M/S. IMOTARA" but PAN and bank agree
        // on no full stop, and those are what penny-drop matches.
        expect(BUSINESS.legalName).toBe(AGREED_LEGAL_NAME);
        expect(BUSINESS.legalName).not.toContain(".");
    });

    it("contact email has not drifted", () => {
        expect(BUSINESS.email).toBe(AGREED_EMAIL);
    });

    it("the registered address is the one on every filing", () => {
        expect(BUSINESS.address.postalCode).toBe(AGREED_POSTCODE);
        expect(formattedAddress()).toContain("Kalipada Mukherjee Road");
        expect(formattedAddress()).toContain("Kolkata");
        expect(formattedAddress()).toContain("India");
    });
});

describe("the site actually shows it, everywhere", () => {
    const footer = read(FOOTER);

    it("the fixture is real", () => {
        expect(footer.length).toBeGreaterThan(1000);
    });

    it("the FOOTER carries it — not a single page", () => {
        // The footer is what makes this true on every route. Moving the name
        // into one page's body would pass a naive grep and fail the audit.
        expect(footer).toMatch(/BUSINESS\.legalName/);
        expect(footer).toMatch(/Operated by/);
    });

    it("it reads from the constant, not a hardcoded string", () => {
        // A literal here could drift from the value the KYC filings carry.
        expect(footer).not.toMatch(/M\/S\.?\s*IMOTARA/);
    });
});
