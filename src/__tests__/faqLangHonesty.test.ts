/**
 * The question pages — 21 languages as of 2026-10-16 — must stay honest, stay
 * question-shaped, and stay in their own script.
 *
 * 🔑 WHY IT EXISTS. These pages carry FAQPage markup, so an AI surface will
 * quote ONE answer with no page around it — and it will do so in a language
 * almost nobody reviewing this repo reads. A wrong sentence here is both more
 * consequential and far less likely to be noticed than a wrong sentence in
 * English. That asymmetry is what most of these assertions are for.
 *
 * ⛔ THE TWO FAILURES THAT ONLY EXIST AT TWENTY-ONE LANGUAGES:
 *   1. a language quietly loses a topic the others have, and nobody notices
 *      because the page still renders
 *   2. a copy-paste leaves one language's answer in its neighbour's script —
 *      the single likeliest way this file breaks, and invisible to a reviewer
 *      who cannot read either
 */

import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { LANG_FAQ, LANG_FAQ_CODES, LANG_FAQ_TOPICS } from "@/data/faqLang";

const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), "utf8");

/**
 * The Unicode block each language must actually be written in. ⚠️ `ur` shares
 * Arabic with no Indian sibling here, and `hi`/`mr` share Devanagari with each
 * other — so Devanagari alone cannot separate those two. Everything else is
 * script-unique, which is what makes this check work at all.
 */
const SCRIPT: Record<string, RegExp> = {
    hi: /[ऀ-ॿ]/,
    mr: /[ऀ-ॿ]/,
    bn: /[ঀ-৿]/,
    pa: /[਀-੿]/,
    gu: /[઀-૿]/,
    or: /[଀-୿]/,
    ta: /[஀-௿]/,
    te: /[ఀ-౿]/,
    kn: /[ಀ-೿]/,
    ml: /[ഀ-ൿ]/,
    ur: /[؀-ۿ]/,

    // ── The ten added 2026-10-16 ─────────────────────────────────────────────
    // ⚠️ FIVE OF THESE ARE LATIN-SCRIPT, so a Unicode block cannot tell them
    // apart — de/fr/es/pt/id would all pass a /[A-Za-z]/ check while being each
    // other's text. They are pinned on distinctive orthography or a very high
    // frequency function word instead, which is weaker than a script check and
    // is why the duplicate-answer test below matters more for them, not less.
    ru: /[Ѐ-ӿ]/,
    ar: /[؀-ۿ]/,
    he: /[֐-׿]/,
    // Japanese must contain kana. Han alone would also match Chinese, and a
    // ja→zh copy-paste is exactly the failure this is here to catch.
    ja: /[぀-ゟ゠-ヿ]/,
    zh: /[一-鿿]/,
    de: /[äöüÄÖÜß]|\b(ich|ist|kann|wenn|was|nicht|und|sie|mir|man|darf|welchem|der|dem)\b/i,
    fr: /[àâçéèêôùûœ]|\b(vous|votre|pas|peut|une|est|puis|des|je|ne|quel)\b/i,
    // ¿ is Spanish-specific punctuation and every Spanish question here opens
    // with one, so it is a much stronger marker than any shared Romance word.
    es: /[¿ñáéíóú]|\b(que|para|puedes|tus)\b/,
    // ã and õ do not occur in Spanish, which is the neighbour pt is likeliest
    // to be confused with.
    pt: /[ãõáéíóúçêâô]|\b(você|não|está|pode|posso|eu|sobre|alguém)\b/i,
    // "yang" is extremely frequent in Indonesian and occurs in none of the
    // other Latin-script languages here.
    id: /\b(yang|tidak|anda|bisa|bisakah|dan|apakah|saya|itu|untuk|kalau|berapa)\b/i,
};

/** 13 and 18 in each language's own digits, as the consent copy writes them. */
const AGE_DIGITS: Record<string, [string, string]> = {
    hi: ["13", "18"], mr: ["13", "18"], ta: ["13", "18"], te: ["13", "18"],
    kn: ["13", "18"], ml: ["13", "18"], gu: ["13", "18"], pa: ["13", "18"],
    ur: ["13", "18"],
    bn: ["১৩", "১৮"],
    or: ["୧୩", "୧୮"],
    // ⚠️ Western digits throughout the ten added 2026-10-16. Arabic and Hebrew
    // both accept them in ordinary modern web prose, and using Arabic-Indic
    // numerals here would silently disagree with the consent copy.
    de: ["13", "18"], fr: ["13", "18"], es: ["13", "18"], pt: ["13", "18"],
    id: ["13", "18"], ru: ["13", "18"], ja: ["13", "18"], zh: ["13", "18"],
    ar: ["13", "18"], he: ["13", "18"],
};

describe("📋 all twenty-one languages are present and well-formed", () => {
    it("covers all twenty-one languages that have a question page", () => {
        // ⚠️ Pinned as an exact list, not a count. A count passes while a
        // language is swapped for another, and the thing that matters is WHICH
        // ones exist — the route, the sitemap and the hreflang set all derive
        // from this. English is deliberately absent: it has /faq itself.
        expect([...LANG_FAQ_CODES].sort()).toEqual(
            [
                "ar", "bn", "de", "es", "fr", "gu", "he", "hi", "id", "ja", "kn",
                "ml", "mr", "or", "pa", "pt", "ru", "ta", "te", "ur", "zh",
            ],
        );
    });

    it("🔑 every language covers the SAME topics — none may quietly lose one", () => {
        // A missing topic still renders a valid page, so only this catches it.
        for (const code of LANG_FAQ_CODES) {
            const ids = LANG_FAQ[code].items.map((i) => i.id);
            expect([...ids].sort(), `${code} topic drift`).toEqual([...LANG_FAQ_TOPICS].sort());
            expect(new Set(ids).size, `${code} has a duplicate topic`).toBe(ids.length);
        }
    });

    it("🔑 every question is actually a QUESTION, in its own script's mark", () => {
        // The entire premise of these pages, and the mark is NOT the same
        // everywhere: Urdu and Arabic end on ؟ (U+061F), Japanese and Chinese
        // on the fullwidth ？ (U+FF1F). Using the Latin ? in CJK is the kind of
        // thing that reads as foreign to a native speaker and as correct to
        // everyone reviewing this repo.
        const MARK: Record<string, string> = { ur: "؟", ar: "؟", ja: "？", zh: "？" };
        for (const code of LANG_FAQ_CODES) {
            const mark = MARK[code] ?? "?";
            const bad = LANG_FAQ[code].items.filter((i) => !i.q.trim().endsWith(mark));
            expect(bad.map((b) => `${code}:${b.id}`)).toEqual([]);
        }
    });

    it("⚠️ every answer stands alone — long enough to be useful, short enough to quote", () => {
        for (const code of LANG_FAQ_CODES) {
            for (const item of LANG_FAQ[code].items) {
                // ⚠️ THE FLOOR IS SCRIPT-DEPENDENT, and a flat one was wrong.
                // 80 characters is a substantial paragraph in Japanese or
                // Chinese and a short phrase in Devanagari — a single number
                // measures density, not substance. CJK answers here run 60–200
                // characters and say as much as a 300-character German one.
                const floor = /^(ja|zh)$/.test(code) ? 45 : 80;
                expect(item.a.length, `${code}:${item.id} too short`).toBeGreaterThan(floor);
                expect(item.a.length, `${code}:${item.id} too long to quote`).toBeLessThan(900);
            }
        }
    });

    it("has non-empty metadata for each language", () => {
        for (const code of LANG_FAQ_CODES) {
            const f = LANG_FAQ[code];
            expect(f.lang).toBe(code);
            for (const field of ["nativeName", "englishName", "title", "description", "intro", "heading"] as const) {
                expect(f[field].trim().length, `${code}.${field} is empty`).toBeGreaterThan(0);
            }
            expect(f.ogLocale).toMatch(/^[a-z]{2}_[A-Z]{2}$/);
        }
    });

    it("⚠️ exactly the three RTL languages are marked rtl", () => {
        // Getting this wrong lays the whole page out backwards, which is the
        // same class of defect as the Arabic crisis card laying out LTR.
        // ⛔ Pinned as a SET, not as "ur is rtl and everything else is not".
        // The old form would have silently passed Arabic and Hebrew as ltr the
        // day they were added — laying both pages out backwards — because
        // nothing asserted which languages SHOULD be rtl.
        const RTL = new Set(["ur", "ar", "he"]);
        for (const code of LANG_FAQ_CODES) {
            expect(LANG_FAQ[code].dir, code).toBe(RTL.has(code) ? "rtl" : "ltr");
        }
        // And that the set itself is still right, so a new RTL language cannot
        // be added to the data without being added here too.
        expect([...LANG_FAQ_CODES].filter((c) => LANG_FAQ[c].dir === "rtl").sort())
            .toEqual(["ar", "he", "ur"]);
    });
});

describe("⛔ each language is written in its OWN script", () => {
    it("🔴 no answer is left in a neighbour's script by a copy-paste", () => {
        // The likeliest way this file breaks, and invisible to a reviewer who
        // reads neither language.
        const offenders: string[] = [];
        for (const code of LANG_FAQ_CODES) {
            const re = SCRIPT[code];
            for (const item of LANG_FAQ[code].items) {
                if (!re.test(item.q)) offenders.push(`${code}:${item.id} question`);
                if (!re.test(item.a)) offenders.push(`${code}:${item.id} answer`);
            }
            if (!re.test(LANG_FAQ[code].heading)) offenders.push(`${code} heading`);
        }
        expect(offenders).toEqual([]);
    });

    it("🔴 no two languages share an identical answer", () => {
        // Devanagari cannot separate Hindi from Marathi by script alone, so
        // this is what catches a hi→mr copy-paste. It also catches the lazier
        // failure of one language being filled in from another wholesale.
        const seen = new Map<string, string>();
        const dupes: string[] = [];
        for (const code of LANG_FAQ_CODES) {
            for (const item of LANG_FAQ[code].items) {
                const key = item.a.trim();
                const prior = seen.get(key);
                if (prior) dupes.push(`${prior} === ${code}:${item.id}`);
                else seen.set(key, `${code}:${item.id}`);
            }
        }
        expect(dupes).toEqual([]);
    });

    it("⛔ carries no mojibake — a broken byte is silent in an unfamiliar script", () => {
        const src = read("src/data/faqLang.ts");
        expect(src.includes("�"), "U+FFFD replacement character in the data").toBe(false);
    });
});

describe("⛔ honest about what Imotara is, in every language", () => {
    it("🔴 the age answer says 13 and 18 in that language's own digits", () => {
        // ⚠️ Must match the consent gate. MINIMUM_AGE said 18 for two days
        // while every translation said 13, and the test that should have
        // caught it passed on the neighbouring number — so pin BOTH.
        for (const code of LANG_FAQ_CODES) {
            const item = LANG_FAQ[code].items.find((i) => i.id === "minimum-age")!;
            const [thirteen, eighteen] = AGE_DIGITS[code];
            expect(item.a, `${code} missing 13`).toContain(thirteen);
            expect(item.a, `${code} missing 18`).toContain(eighteen);
        }
    });

    it("🔴 the crisis answer names a real service and the worldwide directory", () => {
        // Imotara is not an emergency service, and a language is not a country:
        // ⇒ imotaraapp 3ef1937, where an undetected country was shown Indian
        // numbers and ~140 countries were shown none at all.
        for (const code of LANG_FAQ_CODES) {
            const item = LANG_FAQ[code].items.find((i) => i.id === "crisis")!;
            // ⚠️ Every alternative here is copied from
            // src/lib/safety/crisisResources.ts, never typed from memory, and
            // each is distinctive enough that it cannot be matched by accident
            // — which is why Indonesia is pinned on Yayasan Pulih's full number
            // rather than on "119", and Spain on 717 003 717 rather than "024".
            expect(item.a, `${code} names no helpline number`).toMatch(
                /14416|0317-4288665|01779-554391|011-057-6555|1767|0800 111 0 111|3114|717 003 717|213 544 545|188|8-800-2000-122|0120-783-556|400-161-9995|021-788-42580|08008880700|1201/,
            );
            expect(item.a, `${code} omits the worldwide directory`).toContain("findahelpline.com");
        }
    });

    it("🔑 the crisis answer is country-correct where the language spans borders", () => {
        // Bengali is also Bangladesh, Tamil is also Sri Lanka and Singapore,
        // Urdu is mostly Pakistan, Punjabi is both. Numbers copied from
        // src/lib/safety/crisisResources.ts — never typed from memory.
        expect(LANG_FAQ.bn.items.find((i) => i.id === "crisis")!.a).toContain("01779-554391"); // Kaan Pete Roi
        expect(LANG_FAQ.ta.items.find((i) => i.id === "crisis")!.a).toContain("011-057-6555"); // Sumithrayo
        expect(LANG_FAQ.ta.items.find((i) => i.id === "crisis")!.a).toContain("1767");          // SOS Singapore
        expect(LANG_FAQ.ur.items.find((i) => i.id === "crisis")!.a).toContain("0317-4288665"); // Umang
        expect(LANG_FAQ.pa.items.find((i) => i.id === "crisis")!.a).toContain("0317-4288665");

        // 🔑 The ten added 2026-10-16 span borders far more widely than the
        // Indian set does, and naming one country's number to a whole language
        // is the exact defect of 3ef1937 repeated at a larger scale.
        const crisis = (c: string) => LANG_FAQ[c].items.find((i) => i.id === "crisis")!.a;
        expect(crisis("de")).toContain("142");            // Austria
        expect(crisis("de")).toContain("143");            // Switzerland
        expect(crisis("fr")).toContain("143");            // Switzerland
        expect(crisis("es")).toContain("55 5259-8121");   // Mexico, SAPTEL
        expect(crisis("es")).toContain("135");            // Argentina
        expect(crisis("pt")).toContain("188");            // Brazil, CVV
        expect(crisis("pt")).toContain("213 544 545");    // Portugal
        expect(crisis("zh")).toContain("1925");           // Taiwan
        expect(crisis("zh")).toContain("2382 0000");      // Hong Kong
        expect(crisis("zh")).toContain("1767");           // Singapore
        expect(crisis("ar")).toContain("920033360");      // Saudi Arabia
    });

    it("⛔ no Latin promotional vocabulary leaks into any language", () => {
        // Marketing phrases arrive in English even in a translated file.
        const BANNED = [
            "act now", "limited time", "don't miss", "best app", "number one",
            "guaranteed", "risk-free", "sign up now", "exclusive", "revolutionary",
            "100%", "free trial",
        ];
        const offenders: string[] = [];
        for (const code of LANG_FAQ_CODES) {
            const hay = JSON.stringify(LANG_FAQ[code]).toLowerCase();
            for (const w of BANNED) if (hay.includes(w)) offenders.push(`${code}: "${w}"`);
        }
        expect(offenders).toEqual([]);
    });
});

describe("🔍 the pages are built so search and AI surfaces can use them", () => {
    const page = read("src/app/faq/[lang]/page.tsx");
    const english = read("src/app/faq/page.tsx");

    it("emits FAQPage structured data, generated from the rendered data", () => {
        expect(page).toMatch(/"@type": "FAQPage"/);
        expect(page).toMatch(/"@type": "Question"/);
        expect(page).toMatch(/acceptedAnswer/);
        expect(page).toMatch(/mainEntity: faq\.items\.map/);
    });

    it("🔑 declares the page's language to the crawler, in the markup AND the schema", () => {
        expect(page).toMatch(/inLanguage: faq\.lang/);
        expect(page).toMatch(/lang=\{faq\.lang\}/);
        expect(page).toMatch(/dir=\{faq\.dir\}/);
    });

    it("⛔ is a server component — no 'use client'", () => {
        // A client-only page risks the markup not being in the initial HTML,
        // which is the only HTML a crawler is guaranteed to read.
        expect(page.trimStart().startsWith('"use client"')).toBe(false);
    });

    it("⚠️ renders real headings, not a collapsed accordion", () => {
        expect(page).toMatch(/<h2/);
        expect(page).not.toMatch(/<details/);
    });

    it("is statically generated from the data, not an open-ended route", () => {
        expect(page).toMatch(/export function generateStaticParams/);
        expect(page).toMatch(/LANG_FAQ_CODES\.map/);
        // An unknown /faq/xx must 404, not render an empty shell.
        expect(page).toMatch(/notFound\(\)/);
    });

    it("🔑 hreflang is RECIPROCAL — each page names the others and English", () => {
        // Without the return links Google reads the set as unrelated
        // near-duplicates rather than translations of one another.
        expect(page).toMatch(/function hreflangMap/);
        expect(page).toMatch(/"x-default"/);
        expect(english).toMatch(/LANG_FAQ_CODES\.map\(\(c\) => \[c, `\$\{URL\}\/\$\{c\}`\]\)/);
    });

    it("every language page is in the sitemap, enumerated from the data", () => {
        const sitemap = read("src/app/sitemap.ts");
        expect(sitemap).toMatch(/LANG_FAQ_CODES\.map/);
        expect(sitemap).toMatch(/\$\{base\}\/faq\/\$\{lang\}/);
        expect(sitemap).toMatch(/\.\.\.langFaqEntries/);
    });

    it("🔗 the existing brand pages link to their question page", () => {
        // /hi /bn /ta produce no non-brand impressions on their own; the link
        // passes what authority they have to the page built in the shape that
        // works, and gives these pages internal inbound links.
        for (const code of ["hi", "bn", "ta"] as const) {
            expect(read(`src/app/${code}/page.tsx`)).toMatch(
                new RegExp(`href="/faq/${code}"`),
            );
        }
    });

    it("⛔ /help and the English /faq answers were NOT rewritten", () => {
        // The owner's standing constraint: nothing may degrade reply quality or
        // user experience. This work is additive — new routes only.
        const help = read("src/app/help/page.tsx");
        expect(help.trimStart().startsWith('"use client"')).toBe(true);
        expect(help).not.toMatch(/FAQPage/);
        expect(read("src/data/faq.ts")).toMatch(/id: "crisis"/);
    });
});
