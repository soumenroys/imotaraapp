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

describe("🔴 the site-wide schemas are actually EMITTED, not merely defined", () => {
    // Found the hard way on 2026-10-16. A regex meant to remove only the
    // site-wide faqSchema <script> removed every <script> in JsonLd's return.
    // The four objects were still defined, tsc passed, every test passed, the
    // build passed — and the deployed site carried NO Organization, WebSite or
    // app structured data at all. Nothing in the suite was watching whether a
    // defined object ever reached the page.
    //
    // ⛔ So: defining a schema is not emitting it. Assert the emission.
    const layout = read("src/app/layout.tsx");

    for (const name of ["organization", "website", "mobileApp", "webApp"]) {
        it(`${name} is defined AND rendered`, () => {
            expect(layout, `${name} is not defined`).toContain(`const ${name} = {`);
            expect(layout, `${name} is defined but never emitted`)
                .toContain(`JSON.stringify(${name})`);
        });
    }

    it("emits one ld+json script per schema object", () => {
        const defined = (layout.match(/\n  const \w+ = \{\n    "@context"/g) ?? []).length;
        const emitted = (layout.match(/application\/ld\+json/g) ?? []).length;
        expect(emitted, "a schema object is defined with nothing rendering it").toBe(defined);
    });
});

describe("🔴 social handles come from the owner's table, never from code", () => {
    // Found 2026-10-16. `imotara4x` was hardcoded in FOUR places — the twitter
    // card creator and site, the Organization sameAs, and the blog's
    // tweet-intent via= — and it is not Imotara's account. The real one is
    // imotaraofficial.
    //
    // ⛔ WHY THIS IS WORSE THAN HAVING NO HANDLE. `sameAs` is how a search
    // engine ties an entity to its profiles, so a wrong entry asserts that a
    // stranger's account belongs to this company. And `via=` credits that
    // stranger every time a reader shares a post.
    //
    // 🔑 Owner's standing instruction: their social-channels table is the right
    // information. These assert the code DERIVES from the one module that
    // carries it, rather than repeating a handle that can rot.

    it("the wrong handle appears nowhere in live code", () => {
        for (const f of ["src/app/layout.tsx", "src/app/blog/[slug]/page.tsx"]) {
            const src = read(f);
            // Comments may document the old value; code may not use it.
            const code = src
                .split("\n")
                .filter((l) => !l.trim().startsWith("//") && !l.trim().startsWith("*"))
                .join("\n");
            expect(code, `${f} still uses the retired handle`).not.toContain("imotara4x");
        }
    });

    it("the twitter card and sameAs both derive from the identity module", () => {
        const layout = read("src/app/layout.tsx");
        expect(layout).toContain("creator: BUSINESS.social.xHandle");
        expect(layout).toContain("site: BUSINESS.social.xHandle");
        expect(layout).toContain("BUSINESS.social.x,");
    });

    it("sameAs lists every channel the owner actually has", () => {
        const start = read("src/app/layout.tsx").indexOf("const organization = {");
        const layout = read("src/app/layout.tsx");
        const sameAsStart = layout.indexOf("sameAs: [", start);
        const sameAs = layout.slice(sameAsStart, layout.indexOf("]", sameAsStart));
        for (const k of ["BUSINESS.social.x", "BUSINESS.social.instagram", "BUSINESS.social.youtube", "BUSINESS.social.linkedin"]) {
            expect(sameAs, `sameAs is missing ${k}`).toContain(k);
        }
    });

    it("the handle itself is the official one", async () => {
        const { BUSINESS } = await import("@/lib/imotara/businessIdentity");
        expect(BUSINESS.social.xHandle).toBe("@imotaraofficial");
        expect(BUSINESS.social.x).toContain("imotaraofficial");
    });
});

describe("⛔ no social profile URL is hardcoded outside the identity module", () => {
    // 🔴 THREE different X handles existed in this repo at once on 2026-10-16:
    // `imotara4x` in the schema and twitter card, `imotara4me` in the site
    // footer, and `imotaraofficial` — the only real one — in the owner's table.
    // The footer also linked to a LinkedIn profile that had just been deleted.
    //
    // Nothing caught any of it, because a social URL looks plausible wherever
    // it sits and no test ever compared one to anything. This is that test.

    const FILES = [
        "src/components/SiteFooter.tsx",
        "src/app/layout.tsx",
        "src/app/blog/[slug]/page.tsx",
    ];

    // Profile URLs, not share-intent endpoints: /sharing/share-offsite and
    // /intent/tweet are generic and carry no identity.
    const PROFILE_URL = /(x\.com|twitter\.com)\/(?!intent)[A-Za-z0-9_]+|linkedin\.com\/in\/[A-Za-z0-9-]+|instagram\.com\/[A-Za-z0-9_.]+|youtube\.com\/@[A-Za-z0-9_-]+/;

    for (const file of FILES) {
        it(`${file} derives its social links instead of hardcoding them`, () => {
            // ⚠️ Strip comments BEFORE scanning, as whole blocks. A per-line
            // "starts with //" check missed the middle lines of a multi-line
            // {/* … */} JSX comment and reported a documented, retired handle
            // as a live link. Comments must be allowed to quote the wrong value
            // — that is how the next reader learns what went wrong.
            const code = read(file)
                .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
                .replace(/\/\*[\s\S]*?\*\//g, "")
                .split("\n")
                .filter((l) => !l.trim().startsWith("//"))
                .join("\n");

            const offenders = code.split("\n").filter((l) => PROFILE_URL.test(l));
            expect(offenders, `${file} hardcodes a social profile URL`).toEqual([]);
        });
    }
});
