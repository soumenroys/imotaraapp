/**
 * The public FAQ must stay honest, and stay question-shaped.
 *
 * 🔑 WHY IT EXISTS. Search Console, three months to 2026-10-16: 111
 * impressions, position **6.2**, CTR **17.1%**, and **seven queries total** —
 * six of them the brand name or a misspelling. Imotara ranks well and converts
 * well and is simply never shown, because nothing on the site answers anything
 * people type. The one non-brand query was question-shaped. This page is the
 * only thing built in that shape, so the shape is worth defending.
 *
 * ⚠️ 36 of those 111 impressions already came from Google's generative AI
 * features. An AI surface quotes ONE answer without the rest of the page —
 * which is why each answer has to stand alone, and why a dishonest sentence
 * here would travel further than a dishonest sentence anywhere else on the
 * site. That is what most of these assertions guard.
 */

import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { FAQ, FAQ_SECTIONS } from "@/data/faq";

const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), "utf8");

describe("📋 the FAQ is well-formed", () => {
    it("has a reasonable number of entries, with unique ids", () => {
        expect(FAQ.length).toBeGreaterThanOrEqual(20);
        const ids = FAQ.map((f) => f.id);
        expect(new Set(ids).size).toBe(ids.length);
    });

    it("🔑 every question is actually a QUESTION", () => {
        // The entire premise of the page. A statement heading would not match
        // the one query shape that has ever worked here.
        const notQuestions = FAQ.filter((f) => !f.q.trim().endsWith("?")).map((f) => f.id);
        expect(notQuestions).toEqual([]);
    });

    it("every section holds at least one entry, and none is orphaned", () => {
        for (const s of FAQ_SECTIONS) {
            expect(FAQ.filter((f) => f.section === s).length, `${s} is empty`).toBeGreaterThan(0);
        }
        const orphans = FAQ.filter((f) => !FAQ_SECTIONS.includes(f.section)).map((f) => f.id);
        expect(orphans).toEqual([]);
    });

    it("⚠️ every answer stands alone — long enough to be useful, short enough to quote", () => {
        // An AI surface lifts one answer without its neighbours. A two-word
        // answer is useless out of context; a 400-word one will not be quoted.
        for (const f of FAQ) {
            expect(f.a.length, `${f.id} is too short to stand alone`).toBeGreaterThan(120);
            expect(f.a.length, `${f.id} is too long to be quoted`).toBeLessThan(700);
        }
    });

    it("⛔ no answer refers to 'above', 'below' or 'as mentioned'", () => {
        // Those words break the moment the answer is quoted on its own, which
        // is the normal case for an AI surface rather than the exception.
        const bad = FAQ.filter((f) => /\b(as (mentioned|described) (above|below)|see above|see below)\b/i.test(f.a))
            .map((f) => f.id);
        expect(bad).toEqual([]);
    });
});

describe("⛔ honest about what Imotara is", () => {
    it("never CLAIMS to be therapy", () => {
        // Claim-shaped patterns, not a word ban — a phrase ban cannot tell a
        // claim from its denial, which this codebase has now learned three
        // times over in the broadcast templates.
        const CLAIMS = [
            /\b(is|as|provides?|offers?|delivers?)\s+(a\s+)?therapy\b/i,
            /\btherapy\s+(app|service|platform)\b/i,
            /\b(cures?|treats?|diagnoses)\s+(your\s+)?(depression|anxiety|illness)\b/i,
            /\breplaces?\s+(your\s+)?(therapist|counsellor|counselor|doctor)\b/i,
        ];
        const offenders: string[] = [];
        for (const f of FAQ) {
            for (const re of CLAIMS) if (re.test(f.a)) offenders.push(`${f.id}: ${re}`);
        }
        expect(offenders).toEqual([]);
    });

    it("✅ and states plainly that it is NOT therapy", () => {
        // The positive half. A reader arriving from an AI answer may see only
        // one entry, so the denial has to exist as its own question.
        const denial = FAQ.find((f) => /\btherapy\b/i.test(f.q));
        expect(denial, "no question asks whether Imotara is therapy").toBeTruthy();
        expect(denial!.a).toMatch(/\b(not therapy|is not a therapist)\b/i);
    });

    it("🔴 states the age as 13, with parental consent under 18", () => {
        // ⚠️ Must match the Terms and the consent gate. The constant behind the
        // gate said 18 for two days while every translation said 13, and the
        // test that should have caught it passed on the neighbouring number.
        const age = FAQ.find((f) => /\bold\b|\bage\b/i.test(f.q));
        expect(age, "no question asks about the minimum age").toBeTruthy();
        expect(age!.a).toMatch(/\b13\b/);
        expect(age!.a).toMatch(/\b18\b/);
        expect(age!.a).toMatch(/parent|guardian/i);
    });

    it("🔴 the crisis answer names a real service, not just Imotara", () => {
        const crisis = FAQ.find((f) => /crisis/i.test(f.q));
        expect(crisis, "no question covers being in crisis").toBeTruthy();
        expect(crisis!.a).toMatch(/14416|112/);
        expect(crisis!.a).toMatch(/not an emergency service|not monitored/i);
    });

    it("⛔ no promotional vocabulary — this is a reference page, not a pitch", () => {
        const BANNED = [
            "act now", "limited time", "don't miss", "best app", "number one",
            "guaranteed", "risk-free", "sign up now", "exclusive", "revolutionary",
        ];
        const offenders: string[] = [];
        for (const f of FAQ) {
            const hay = `${f.q} ${f.a}`.toLowerCase();
            for (const w of BANNED) if (hay.includes(w)) offenders.push(`${f.id}: "${w}"`);
        }
        expect(offenders).toEqual([]);
    });
});

describe("🔍 the page is built so search and AI surfaces can use it", () => {
    const page = read("src/app/faq/page.tsx");

    it("emits FAQPage structured data", () => {
        expect(page).toMatch(/"@type": "FAQPage"/);
        expect(page).toMatch(/"@type": "Question"/);
        expect(page).toMatch(/acceptedAnswer/);
    });

    it("🔑 the schema is GENERATED from the same data the page renders", () => {
        // Two hand-kept copies drift, and the one search engines read is the
        // one nobody ever looks at.
        expect(page).toMatch(/mainEntity: FAQ\.map/);
    });

    it("⛔ is a server component — no 'use client'", () => {
        // A client-only page risks the markup not being in the initial HTML,
        // which is the only HTML a crawler is guaranteed to read.
        expect(page.trimStart().startsWith('"use client"')).toBe(false);
    });

    it("⚠️ renders real headings, not a collapsed accordion", () => {
        expect(page).toMatch(/<h3/);
        expect(page).not.toMatch(/<details/);
    });

    it("is listed in the sitemap and allowed by robots", () => {
        expect(read("src/app/sitemap.ts")).toMatch(/\$\{base\}\/faq/);
        expect(read("src/app/robots.ts")).toMatch(/"\/faq"/);
    });

    it("carries a canonical URL", () => {
        expect(page).toMatch(/canonical: URL,?/);
    });

    it("🔑 and points at its Indian-language translations, reciprocally", () => {
        // The eleven /faq/<lang> pages each name this one; without the return
        // links Google reads the set as unrelated near-duplicates rather than
        // translations of one another. ⚠️ This assertion is why the canonical
        // pin above had to loosen — `alternates` grew a `languages` map.
        expect(page).toMatch(/languages: \{/);
        expect(page).toMatch(/LANG_FAQ_CODES/);
        expect(page).toMatch(/"x-default": URL/);
    });

    it("⛔ /help was NOT modified — the owner's constraint", () => {
        // /help is an interactive client assistant. The standing instruction is
        // that nothing may degrade reply quality or user experience, so the FAQ
        // was added as a NEW route rather than bolted onto a working surface.
        const help = read("src/app/help/page.tsx");
        expect(help.trimStart().startsWith('"use client"')).toBe(true);
        expect(help).not.toMatch(/FAQPage/);
    });
});
