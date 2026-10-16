// E-E-A-T schema guards.
//
// 🔑 WHY. For a health-adjacent site, structured data is a claim about who
// stands behind the content, and an AI surface quotes a single answer with no
// page around it. Both of those make the identity in the markup load-bearing.
//
// 🔴 THE FAILURE THESE EXIST TO PREVENT IS FABRICATION, NOT ABSENCE. Health
// sites routinely carry "medically reviewed by Dr X" markup; it is the most
// tempting thing to invent for E-E-A-T and the most damaging to invent on a
// mental-health site. Nobody clinical reviews this content.

import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

import { BUSINESS } from "@/lib/imotara/businessIdentity";
import { publisherNode, NOT_THERAPY_SCHEMA_NOTE } from "@/lib/seo/publisher";

const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), "utf8");

describe("the publisher node", () => {
    // ⛔ Derived, not retyped. businessIdentity.ts is matched to the firm PAN
    // and bank account; a hardcoded second copy would drift, and the drifting
    // one would be the public one.
    it("takes every fact from the business identity module", () => {
        const node = publisherNode();
        expect(node.legalName).toBe(BUSINESS.legalName);
        expect(node.email).toBe(BUSINESS.email);
        expect(node.url).toBe(BUSINESS.website);
        expect(node.name).toBe(BUSINESS.brand);
    });

    it("states plainly that this is not therapy", () => {
        const lower = NOT_THERAPY_SCHEMA_NOTE.toLowerCase();
        expect(lower).toContain("not therapy");
        expect(lower).toContain("not a crisis service");
    });
});

describe("⛔ no fabricated clinical authority anywhere in the markup", () => {
    // These files are what actually reaches a crawler.
    const FILES = [
        "src/app/layout.tsx",
        "src/lib/seo/publisher.ts",
        "src/app/answers/[slug]/page.tsx",
        "src/app/compare/[slug]/page.tsx",
    ];

    it("claims no medical reviewer, no clinician, no doctor", () => {
        const offenders: string[] = [];
        for (const f of FILES) {
            const src = read(f);
            // Only the schema-shaped claims — a comment saying "no medical
            // reviewer" must not trip this, so the patterns are the JSON-LD
            // property forms, not the bare words.
            for (const pattern of [
                /"reviewedBy"\s*:/,
                /reviewedBy\s*:/,
                /"medicalAudience"\s*:/,
                /"@type"\s*:\s*"Physician"/,
                /"@type"\s*:\s*"MedicalWebPage"/,
                /honorificPrefix\s*:\s*"Dr/,
            ]) {
                if (pattern.test(src)) offenders.push(`${f}: ${pattern}`);
            }
        }
        expect(offenders).toEqual([]);
    });

    // 🔑 The author is the organisation, which is true, rather than a Person
    // who does not exist. Naming a real individual in public structured data is
    // the owner's decision to make, not one to be inferred from a git log.
    it("attributes authorship to the organisation, not to an invented person", () => {
        const layout = read("src/app/layout.tsx");
        expect(layout).toContain('author: { "@type": "Organization"');
        expect(layout).not.toMatch(/author:\s*\{\s*"@type":\s*"Person"/);
    });
});

describe("the organisation is identifiable", () => {
    const layout = read("src/app/layout.tsx");

    // A site that will not say who it is does not get cited, and for YMYL
    // content Google asks for exactly these.
    it("publishes a legal name, a postal address and a way to reach a human", () => {
        expect(layout).toContain("legalName: BUSINESS.legalName");
        expect(layout).toContain('"@type": "PostalAddress"');
        expect(layout).toContain('"@type": "ContactPoint"');
        expect(layout).toContain("email: BUSINESS.email");
        expect(layout).toContain("telephone: BUSINESS.phone");
    });

    it("lists both app stores in the organisation's OWN sameAs", () => {
        // ⚠️ A whole-file `toContain` passed this even with the Apple link
        // deleted from sameAs, because the same URL also appears in the
        // MobileApplication node's downloadUrl and installUrl. A guard that
        // cannot fail is worse than none: it reports safety it has not checked.
        // So read the organisation's sameAs array specifically.
        const start = layout.indexOf("const organization = {");
        expect(start, "organization block not found").toBeGreaterThan(-1);
        const sameAsStart = layout.indexOf("sameAs: [", start);
        const sameAs = layout.slice(sameAsStart, layout.indexOf("]", sameAsStart));

        expect(sameAs).toContain("play.google.com/store/apps/details?id=com.imotara.imotara");
        expect(sameAs).toContain("apps.apple.com/in/app/imotara/id6756697569");
    });
});

describe("⛔ FAQPage markup only where the questions are visible", () => {
    // 🔴 THE DEFECT THIS PINS, found 2026-10-16. The root layout emitted a
    // generic FAQPage, so EVERY url on the site claimed to be an FAQ page —
    // /privacy, /terms, /blog, all of them — while those questions were
    // visible only on the homepage. Measured in production before the fix:
    // /privacy carried FAQPage markup for content it does not contain.
    //
    // ⚠️ It also COLLIDED. /answers/*, /compare/* and /faq/<lang> each emit
    // their own FAQPage, so those urls carried two at once and nothing told a
    // crawler which described the page.
    it("is not in the root layout", () => {
        expect(read("src/app/layout.tsx")).not.toContain('"@type": "FAQPage"');
    });

    it("is on the homepage, which is the page those questions appear on", () => {
        expect(read("src/app/page.tsx")).toContain("HOME_FAQ_SCHEMA");
    });

    it("the homepage schema is a real FAQPage with questions", () => {
        const src = read("src/lib/seo/homeFaqSchema.ts");
        expect(src).toContain('"@type": "FAQPage"');
        // More than one, or it is not an FAQ.
        expect((src.match(/"@type": "Question"/g) ?? []).length).toBeGreaterThan(1);
    });
});
