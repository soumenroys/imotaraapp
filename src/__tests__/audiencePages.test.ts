/**
 * The /for/* audience landing pages.
 *
 * These began as ten separate PDFs, and ten copies of the same facts had
 * already drifted: the Seniors sheet lost the Pro tier, one said "22
 * languages" where another said "all languages", Connect moved in and out of
 * the pricing table. The fix was to make the content data with pricing defined
 * once — these tests are what stop it drifting back.
 *
 * They also pin the facts to their systems of record, because a marketing page
 * that quietly disagrees with the checkout is worse than no page at all.
 */
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import {
    AUDIENCE_PAGES,
    CONSUMER_PLANS,
    SENIOR_PLANS,
    type AudiencePage,
} from "@/data/audiencePages";

const pages = Object.values(AUDIENCE_PAGES) as AudiencePage[];
const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), "utf8");

describe("every audience page is complete", () => {
    it("there are ten of them, six for people and four for organisations", () => {
        expect(pages).toHaveLength(10);
        expect(pages.filter((p) => !p.institutional)).toHaveLength(6);
        expect(pages.filter((p) => p.institutional)).toHaveLength(4);
    });

    it.each(pages.map((p) => [p.slug, p] as const))("%s has everything the renderer needs", (_slug, p) => {
        expect(p.hook.length).toBeGreaterThan(10);
        expect(p.standfirst.length).toBeGreaterThan(20);
        expect(p.intro.length).toBeGreaterThanOrEqual(2);
        expect(p.cards).toHaveLength(4);
        expect(p.moments.length).toBeGreaterThanOrEqual(4);
        expect(p.plans.length).toBeGreaterThanOrEqual(3);
        expect(p.pullQuote.length).toBeGreaterThanOrEqual(2);
        expect(p.closing.body.length).toBeGreaterThan(50);
    });

    it("the key of each entry matches its own slug", () => {
        // A mismatch would give a page whose URL and canonical disagree.
        for (const [key, p] of Object.entries(AUDIENCE_PAGES)) expect(p.slug).toBe(key);
    });

    it("each has its own metadata — no two pages compete for the same query", () => {
        const titles = pages.map((p) => p.metaTitle);
        const descs = pages.map((p) => p.metaDescription);
        expect(new Set(titles).size).toBe(titles.length);
        expect(new Set(descs).size).toBe(descs.length);
        // Google truncates descriptions around 160 characters.
        for (const d of descs) expect(d.length).toBeLessThanOrEqual(175);
    });
});

describe("pricing is defined once, and agrees with the systems of record", () => {
    it("consumer pages all share the SAME plan table object", () => {
        // This is the drift fix. If someone hand-writes a table for one
        // audience, the prices can diverge silently — as they already had.
        const consumer = pages.filter((p) => !p.institutional && p.slug !== "seniors");
        for (const p of consumer) expect(p.plans).toBe(CONSUMER_PLANS);
    });

    it("Seniors deliberately swaps Pro for Connect — and says so honestly", () => {
        const seniors = AUDIENCE_PAGES.seniors;
        expect(seniors.plans).toBe(SENIOR_PLANS);
        expect(seniors.plans.map((r) => r.name)).toEqual(["Free", "Plus", "Talk to a person"]);
        // A simplification is fine; hiding a tier is not. The note must point
        // at the full comparison.
        expect(seniors.plansNote).toMatch(/Pro plan/);
    });

    it("the prices match PRODUCT_CATALOG (paise), the system of record", () => {
        const catalog = read("src/lib/imotara/grantLicense.ts");
        expect(catalog).toMatch(/plus_monthly:\s*\{[^}]*paise:\s*9_900/);
        expect(catalog).toMatch(/plus_annual:\s*\{[^}]*paise:\s*69_900/);
        expect(catalog).toMatch(/pro_monthly:\s*\{[^}]*paise:\s*14_900/);
        expect(catalog).toMatch(/pro_annual:\s*\{[^}]*paise:\s*129_900/);

        const plus = CONSUMER_PLANS.find((r) => r.name === "Plus")!;
        const pro = CONSUMER_PLANS.find((r) => r.name === "Pro")!;
        expect(plus.cost).toBe("₹99 / month or ₹699 / year");
        expect(pro.cost).toBe("₹149 / month or ₹1,299 / year");
    });

    it("every page links onward to the full plan comparison", () => {
        expect(read("src/app/for/[audience]/page.tsx")).toMatch(/href="\/upgrade"/);
    });
});

describe("claims we can actually stand behind", () => {
    it("22 languages is the real count, not a round number", () => {
        const langs = read("src/lib/connect/languages.ts");
        expect((langs.match(/code: *"/g) ?? []).length).toBe(22);
    });

    it("nothing repeats the unsubstantiated '71 approaches' figure", () => {
        // The institutional PDFs claimed "71 evidence-informed approaches".
        // That number appears nowhere in this codebase. A precise figure aimed
        // at hospitals and medical colleges that nobody can source is a
        // liability — the substance (CBT, DBT, ACT, mindfulness) is kept, the
        // number is not. Put it back only with a citable source.
        const data = read("src/data/audiencePages.ts");
        const body = data.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");
        expect(body).not.toMatch(/\b71\b/);
    });

    it("no page promises therapy or diagnosis", () => {
        // The one claim this product must never make.
        for (const p of pages) {
            const all = [p.hook, p.standfirst, ...p.intro, p.afterCards, p.closing.body].join(" ");
            expect(all).not.toMatch(/\bwe diagnose\b|\bis therapy\b|\breplaces? (a )?(therapist|doctor|counsellor)\b/i);
        }
    });
});

describe("the pages are discoverable", () => {
    it("the sitemap enumerates them from the data, not a hand-written list", () => {
        const sm = read("src/app/sitemap.ts");
        expect(sm).toMatch(/AUDIENCE_PAGES/);
        expect(sm).toMatch(/\/for\/\$\{slug\}/);
        expect(sm).toMatch(/\$\{base\}\/for`/);
    });

    it("the index links to all ten", () => {
        expect(read("src/app/for/page.tsx")).toMatch(/\/for\/\$\{p\.slug\}/);
    });

    it("each page is statically generated", () => {
        expect(read("src/app/for/[audience]/page.tsx")).toMatch(/export function generateStaticParams/);
    });
});
