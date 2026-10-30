/**
 * public/llms.txt is read by language models and repeated to people verbatim.
 *
 * 🔴 WHY THIS EXISTS. On 2026-10-16 that file was telling assistants four
 * things that were not true:
 *
 *   - "No third-party analytics"      — Google Analytics was live on the site.
 *   - "Free tier: unlimited conversations" — Free is 20 CLOUD replies a day.
 *   - "Twitter/X: twitter.com/imotara4x"   — not Imotara's handle. That wrong
 *     handle had been removed from four places in the code THAT MORNING and
 *     survived here, because this is a static file in public/ rather than
 *     anything generated from BUSINESS.social.
 *   - nothing about /answers, /compare, /faq or /for — the 37 pages built
 *     specifically so that language models would have something to quote.
 *
 * ⚠️ A stale marketing page is a stale page. A stale llms.txt is a wrong
 * answer delivered at scale, by a system the reader trusts, with no way for
 * them to check it.
 *
 * ⛔ THE SHAPE OF THIS TEST. It pins the claims that have already gone wrong,
 * and it pins the social URLs against BUSINESS.social so the two cannot drift
 * apart again. It deliberately does NOT try to verify every sentence — a
 * guard nobody can keep green gets deleted.
 */

import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { BUSINESS } from "@/lib/imotara/businessIdentity";

const ROOT = process.cwd();

/**
 * 🔴 THE RAW FILE, COMMENTS AND ALL — because that is what a language model
 * reads.
 *
 * ⚠️ The first version of this test stripped `<!-- -->` before asserting, on
 * the assumption that a comment is invisible. It is invisible in HTML. This is
 * a .txt file: a model ingests the comment as content. The first draft of the
 * explanatory note inside llms.txt quoted the four wrong claims it was
 * correcting — and the stripped-comment test passed while the wrong handle and
 * the false analytics line were live on imotara.com/llms.txt.
 *
 * ⛔ Negative assertions MUST run against this raw text. If a falsehood is
 * anywhere in the bytes, it is in the model's context.
 */
const LLMS = fs.readFileSync(path.join(ROOT, "public/llms.txt"), "utf8");

describe("llms.txt does not repeat the claims that were wrong", () => {
    it("does not claim there is no third-party analytics", () => {
        // Google Analytics is live on the website and disclosed in the privacy
        // policy. Saying otherwise here contradicts our own policy.
        expect(LLMS).not.toMatch(/no third-party analytics/i);
    });

    it("does not describe the free tier as unlimited conversations", () => {
        expect(LLMS).not.toMatch(/unlimited conversations/i);
    });

    it("states the real free tier and the real price", () => {
        expect(LLMS).toMatch(/twenty cloud replies a day/i);
        expect(LLMS).toMatch(/₹149/);
    });

    it("does not call Connect companions clinical", () => {
        // Same rule the product follows: Connect is peer support. See
        // connectIsNeverCalledClinical.test.ts.
        const claims = LLMS.split("\n")
            // ⚠️ A bare link line is a URL, not a claim. The compare page
            // /compare/ai-companion-vs-human-counsellor exists precisely to
            // discuss the difference, and the first version of this guard
            // flagged its own slug.
            .filter((l) => !/^\s*-?\s*https?:\/\/\S+\s*$/.test(l))
            .filter(
                (l) =>
                    /\b(counsell?ors?|therapists?|psychologists?)\b/i.test(l) &&
                    !/\b(not|never|no)\b/i.test(l),
            );
        expect(claims).toEqual([]);
    });
});

describe("llms.txt carries the social handles from BUSINESS.social", () => {
    it("uses the real X handle, not the one that was wrong in four places", () => {
        expect(LLMS).toContain(BUSINESS.social.x);
        expect(LLMS).not.toMatch(/imotara4x|imotara4me/i);
    });

    for (const key of ["instagram", "youtube", "linkedin", "facebook"] as const) {
        it(`links ${key} as BUSINESS.social says`, () => {
            expect(LLMS).toContain(BUSINESS.social[key]);
        });
    }
});

describe("llms.txt points at the pages built to be quoted", () => {
    /**
     * ⚠️ These counts are the POINT of the file. A1–A6 built 37 pages so that
     * an assistant answering "how do I stop overthinking at night" would have
     * something of ours to cite. If llms.txt does not list them, it does not
     * matter that they exist.
     */
    it("lists all eight answer pages", () => {
        const found = LLMS.match(/imotara\.com\/answers\/[a-z-]+/g) ?? [];
        expect(new Set(found).size).toBe(8);
    });

    it("lists all five comparison pages", () => {
        const found = LLMS.match(/imotara\.com\/compare\/[a-z-]+/g) ?? [];
        expect(new Set(found).size).toBe(5);
    });

    it("points at the audience pages and the language FAQs", () => {
        expect(LLMS).toMatch(/imotara\.com\/for\b/);
        expect(LLMS).toMatch(/imotara\.com\/faq\b/);
    });
});

describe("llms.txt says what Imotara is not", () => {
    it("states plainly that it is not therapy or a crisis service", () => {
        expect(LLMS).toMatch(/not therapy, not a doctor, and not a crisis service/i);
    });

    // 🔑 Owner, 30 Oct 2026: worldwide — no one country's number. The real
    // route is the reader's own country, with the worldwide directory behind it.
    it("names a real helpline route, for any country", () => {
        expect(LLMS).toMatch(/helpline for the user's own country/);
        expect(LLMS).toMatch(/findahelpline\.com/);
        expect(LLMS).not.toMatch(/Tele-MANAS|14416/);
    });
});
