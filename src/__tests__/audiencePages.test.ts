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
import { paiseFor, inr } from "@/lib/imotara/pricing";
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
        // 2 since the Plus/Pro merge (L10): Free + Imotara Plus. Institutional
        // pages carry more. The point of the floor is that a page never ships
        // with an empty or one-row plan table, not that there are three tiers.
        expect(p.plans.length).toBeGreaterThanOrEqual(2);
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

    it("Seniors add Connect alongside the paid plan", () => {
        const seniors = AUDIENCE_PAGES.seniors;
        expect(seniors.plans).toBe(SENIOR_PLANS);
        expect(seniors.plans.map((r) => r.name)).toEqual(["Free", "Imotara Plus", "Talk to a person"]);
        // This used to swap Pro OUT for Connect, so the note had to promise the
        // reader a tier they could not see. Since the merge there is only one
        // paid plan and nothing is hidden — but the page must still point at
        // the full comparison rather than imply this table is all there is.
        expect(seniors.plansNote).toMatch(/\/upgrade|see all/i);
        expect(seniors.plansNote).not.toMatch(/\bPro plan\b/);
    });

    it("the prices match PRODUCT_CATALOG (paise), the system of record", () => {
        // This used to regex grantLicense.ts as TEXT, which broke the moment the
        // catalog moved to lib/imotara/pricing.ts — a false failure about a real
        // refactor. Reading the values instead means the test follows the data.
        // The exact amounts are pinned once, in pricingCatalog.test.ts.
        // One paid row since the merge, priced at the pro_* SKUs.
        const paid = CONSUMER_PLANS.find((r) => r.name === "Imotara Plus")!;
        expect(paid.cost).toBe(
            `${inr(paiseFor("pro_monthly"))} / month or ${inr(paiseFor("pro_annual"))} / year`,
        );
        // The retired plus_* price must not still be advertised anywhere here.
        expect(CONSUMER_PLANS.some((r) => r.cost.includes(inr(paiseFor("plus_monthly"))))).toBe(false);
    });

    it("every page links onward to the full plan comparison", () => {
        expect(read("src/app/for/[audience]/page.tsx")).toMatch(/href="\/upgrade"/);
    });

    it("the cost is readable on a phone without scrolling sideways", () => {
        // Found in the Android emulator 2026-09-15: a three-column table in an
        // overflow-x-auto container put the COST column off-screen, reachable
        // only by a horizontal scroll nobody discovers — worst on the Seniors
        // page. Phones now get stacked blocks; the table starts at sm.
        // Comments stripped first — the file's own explanation NAMES the
        // classes it no longer uses, and a not.toMatch would match the prose
        // rather than the markup.
        const src = read("src/app/for/[audience]/page.tsx")
            .replace(/\/\*[\s\S]*?\*\//g, "")
            .replace(/^[ \t]*\/\/.*$/gm, "");
        expect(src).toMatch(/sm:hidden/);        // stacked list, phones only
        expect(src).toMatch(/hidden sm:block/);  // the table, sm and up
        expect(src).not.toMatch(/overflow-x-auto/);
        expect(src).not.toMatch(/min-w-\[34rem\]/);
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
