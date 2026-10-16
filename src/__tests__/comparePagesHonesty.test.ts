// Guards on the /compare decision pages.
//
// These pages exist because the site ranks for its own name and nothing else
// (Search Console, 3 months to 2026-10-16: 111 impressions, 7 queries, 6 of
// them the brand). They are aimed at the decision a reader is making, which
// means they are read by people who may be unwell — so the honesty properties
// are load-bearing, not stylistic.
//
// ⛔ WHAT THESE DELIBERATELY DO NOT DO: assert that some sentence is present.
// A text assertion passes on dead code and survives any refactor
// (trap_a_mirror_test_cannot_catch_a_refactor, and the guard-satisfied-by-a-
// neighbouring-value trap). These assert STRUCTURAL properties of the data that
// cannot be satisfied accidentally.

import { describe, it, expect } from "vitest";

import { COMPARE_PAGES, COMPARE_SLUGS, comparePageFor } from "@/data/comparePages";

describe("compare pages", () => {
    it("exposes at least one page and a lookup that rejects unknown slugs", () => {
        expect(COMPARE_SLUGS.length).toBeGreaterThan(0);
        expect(comparePageFor("definitely-not-a-page")).toBeUndefined();
    });

    for (const slug of COMPARE_SLUGS) {
        const page = COMPARE_PAGES[slug];

        // 🔴 THE LOAD-BEARING ONE. A page that only sells is the page an
        // assistant declines to quote, and in a wellness product overclaiming
        // is a safety problem before it is a marketing one.
        it(`${slug} says where Imotara is the WRONG choice`, () => {
            expect(page.notFor.length).toBeGreaterThanOrEqual(3);
            for (const item of page.notFor) {
                expect(item.trim().length).toBeGreaterThan(40);
            }
        });

        // 🔴 Every one of these pages is read by someone deciding whether an
        // app is enough. At least one must point at a real service.
        it(`${slug} names a real crisis route or states it is not therapy`, () => {
            const all = [...page.notFor, page.shortAnswer, ...page.sections.flatMap((s) => s.body)].join(" ");
            const namesService = /14416|findahelpline\.com|112/.test(all);
            const disclaims = /not therapy/i.test(all);
            expect(namesService || disclaims).toBe(true);
        });

        // ⛔ The no-named-competitor rule, enforced rather than trusted. These
        // are claims nobody in this repo can verify and nobody maintains.
        it(`${slug} makes no claims about named competitor products`, () => {
            const all = JSON.stringify(page).toLowerCase();
            for (const brand of ["wysa", "woebot", "replika", "youper", "headspace", "calm", "betterhelp", "talkspace"]) {
                expect(all).not.toContain(brand);
            }
        });

        it(`${slug} answers the question before the table`, () => {
            expect(page.question.trim().endsWith("?")).toBe(true);
            // Quotable, but not a stub: this is the paragraph assistants lift.
            expect(page.shortAnswer.trim().length).toBeGreaterThan(120);
        });

        it(`${slug} has a comparison table with both columns populated`, () => {
            expect(page.rows.length).toBeGreaterThanOrEqual(4);
            for (const row of page.rows) {
                expect(row.criterion.trim().length).toBeGreaterThan(0);
                expect(row.imotara.trim().length).toBeGreaterThan(0);
                expect(row.other.trim().length).toBeGreaterThan(0);
            }
        });

        it(`${slug} carries its own metadata and keywords`, () => {
            expect(page.metaTitle.trim().length).toBeGreaterThan(10);
            expect(page.metaDescription.trim().length).toBeGreaterThan(50);
            expect(page.keywords.length).toBeGreaterThanOrEqual(3);
        });
    }
});
