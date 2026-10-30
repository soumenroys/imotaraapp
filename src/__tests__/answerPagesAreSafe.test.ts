// Safety guards on /answers/*.
//
// 🔴 WHY THESE ARE NOT COSMETIC. Every one of these pages is read by someone
// in the middle of the thing it describes — at night, alone, searching the
// exact words. A page that overclaims, or that leaves someone with nowhere to
// go, does harm that no amount of traffic justifies.
//
// ⛔ These assert STRUCTURAL properties of the data, not the presence of
// sentences. A text assertion passes on dead code and survives any refactor.

import { describe, it, expect } from "vitest";

import { ANSWER_PAGES, ANSWER_SLUGS, answerPageFor } from "@/data/answerPages";

describe("answer pages", () => {
    it("exposes pages and a lookup that rejects unknown slugs", () => {
        expect(ANSWER_SLUGS.length).toBeGreaterThan(0);
        expect(answerPageFor("not-a-page")).toBeUndefined();
    });

    for (const slug of ANSWER_SLUGS) {
        const page = ANSWER_PAGES[slug];
        const allText = [
            page.shortAnswer,
            ...page.sections.flatMap((s) => s.body),
            ...page.tryNow,
            ...page.whenToGetHelp,
        ].join(" ");

        // 🔴 THE LOAD-BEARING ONE.
        it(`${slug} names a real crisis service, country-aware`, () => {
            expect(page.whenToGetHelp.length).toBeGreaterThanOrEqual(2);
            const help = page.whenToGetHelp.join(" ");
            // The worldwide directory AND the reader's own emergency number.
            // Naming only one country is the exact defect fixed in imotaraapp
            // 3ef1937, where ~140 countries were shown no helpline at all.
            expect(help).toContain("findahelpline.com");
            expect(help).toContain("local emergency number");
        });

        // 🔑 Owner, 30 Oct 2026: these pages are read worldwide — no country,
        // no country's number, no currency. (The in-app crisis card is still
        // country-aware; that is a different surface.)
        it(`${slug} is written for every country`, () => {
            const all = JSON.stringify(page);
            for (const local of ["India", "Tele-MANAS", "14416", "₹", " GP "]) {
                expect(all).not.toContain(local);
            }
        });

        // ⛔ This is a wellness companion, not a clinician. These verbs are the
        // line between the two, and crossing it is a safety problem before it
        // is a legal one.
        it(`${slug} makes no treatment or diagnosis claim`, () => {
            const lower = allText.toLowerCase();
            for (const phrase of [
                "we can cure",
                "will cure",
                "imotara treats",
                "we diagnose",
                "clinically proven",
                "medically proven",
                "guaranteed to",
            ]) {
                expect(lower).not.toContain(phrase);
            }
        });

        // ⛔ Never tell the reader what they have.
        it(`${slug} does not tell the reader they have a condition`, () => {
            const lower = allText.toLowerCase();
            for (const phrase of ["you have depression", "you have anxiety disorder", "you are depressed"]) {
                expect(lower).not.toContain(phrase);
            }
        });

        it(`${slug} answers in the first paragraph`, () => {
            expect(page.question.trim().endsWith("?")).toBe(true);
            // Quotable but not a stub — this is the paragraph assistants lift.
            expect(page.shortAnswer.trim().length).toBeGreaterThan(140);
        });

        it(`${slug} gives something concrete to do`, () => {
            expect(page.tryNow.length).toBeGreaterThanOrEqual(3);
            for (const item of page.tryNow) {
                expect(item.trim().length).toBeGreaterThan(30);
            }
        });

        it(`${slug} carries its own metadata and keywords`, () => {
            expect(page.metaTitle.trim().length).toBeGreaterThan(10);
            expect(page.metaDescription.trim().length).toBeGreaterThan(50);
            expect(page.keywords.length).toBeGreaterThanOrEqual(3);
        });
    }
});
