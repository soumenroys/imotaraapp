/**
 * A person in crisis must never be shown an empty crisis card, and must never
 * be shown another country's helpline.
 *
 * 🔴 WHAT THIS WAS WRITTEN FOR. `getCrisisResourcesForCountry` had two defects
 * that shipped together for months:
 *
 *   · `if (!code) return INDIA_CRISIS_RESOURCES` — every user whose country
 *     could not be determined was shown INDIAN numbers. On mobile that is the
 *     routine case, not the rare one: there is no geo header there, only an
 *     Intl locale heuristic.
 *   · `return COUNTRY_RESOURCES_MAP[code] ?? null` — a user in any of the ~140
 *     countries without its own entry got nothing. The mobile Tier-1 card then
 *     did `if (!primary) return null`, and the Tier-2 card rendered a heading
 *     promising help with an EMPTY list of numbers underneath it.
 *
 * ⛔ The fix is a fallback that deliberately carries NO phone number — no
 * number is right everywhere, and a crisis line that does not answer is worse
 * than a directory that does. These assertions pin both halves: something is
 * always returned, and what is returned is never wrong-country.
 */

import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import {
    getCrisisResourcesForCountry,
    INDIA_CRISIS_RESOURCES,
    INTERNATIONAL_CRISIS_RESOURCES,
} from "@/lib/safety/crisisResources";

const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), "utf8");

/** Codes with no entry of their own — the case that used to return null. */
const UNCOVERED = [
    "NP", "BT", "MM", "KH", "LA", "MN", "AF", "UZ", "KZ", "GE", "AM", "AZ",
    "UA", "BG", "HR", "RS", "SK", "SI", "LT", "LV", "EE", "IS", "LU", "MT",
    "CY", "AL", "BA", "MK", "ME", "BY", "MD",
    "GH", "ET", "TZ", "UG", "ZM", "ZW", "SN", "CI", "CM", "RW", "BW", "NA",
    "MU", "MZ", "AO", "SD", "LY",
    "QA", "KW", "BH", "OM", "YE", "SY", "IR",
    "VN", "BN", "MV", "FJ", "PG",
    "EC", "BO", "PY", "UY", "VE", "CR", "PA", "GT", "DO", "CU", "JM", "TT",
    "HN", "NI", "SV", "BZ", "GY", "SR",
];

/** The shapes a real browser or device can actually hand us. */
const NON_ANSWERS = [undefined, null, "", "   ", "ZZ", "XX", "QQ", "zz"];

describe("🔴 nobody in crisis is left with nothing", () => {
    it("always returns resources, for every input shape", () => {
        for (const code of [...NON_ANSWERS, ...UNCOVERED]) {
            const r = getCrisisResourcesForCountry(code as string | null | undefined);
            expect(r, `no resources for ${JSON.stringify(code)}`).toBeTruthy();
        }
    });

    it("🔑 and those resources always hold at least one contactable line", () => {
        // An object with an empty `primary` would satisfy the assertion above
        // and still render an empty card. This is the one that matters.
        for (const code of [...NON_ANSWERS, ...UNCOVERED]) {
            const r = getCrisisResourcesForCountry(code as string | null | undefined);
            expect(r.primary.length, `empty primary for ${JSON.stringify(code)}`).toBeGreaterThan(0);
            const line = r.primary[0];
            expect(line.label.trim().length).toBeGreaterThan(0);
            expect(line.contact.trim().length).toBeGreaterThan(0);
        }
    });
});

describe("⛔ nobody is shown another country's helpline", () => {
    it("an undetected country does NOT get Indian numbers", () => {
        // The exact defect. Tele-MANAS is a Government of India service on a
        // short code that does not dial from anywhere else.
        for (const code of NON_ANSWERS) {
            const r = getCrisisResourcesForCountry(code as string | null | undefined);
            expect(r.countryCode, `${JSON.stringify(code)} resolved to India`).not.toBe("IN");
            const text = JSON.stringify(r);
            expect(text).not.toMatch(/14416|Tele-MANAS|KIRAN|NIMHANS/);
        }
    });

    it("an uncovered country gets the international directory, not a neighbour's numbers", () => {
        for (const code of UNCOVERED) {
            const r = getCrisisResourcesForCountry(code);
            expect(r, code).toBe(INTERNATIONAL_CRISIS_RESOURCES);
        }
    });

    it("✅ a covered country still gets its OWN numbers — the fix did not flatten everyone", () => {
        // The control. If the fallback had swallowed the map, every assertion
        // above would still pass.
        expect(getCrisisResourcesForCountry("IN")).toBe(INDIA_CRISIS_RESOURCES);
        for (const [code, expected] of [
            ["US", "988"], ["GB", "116 123"], ["JP", "0120-783-556"], ["SG", "1767"],
            ["DE", "0800 111 0 111"], ["BR", "188"], ["AU", "13 11 14"], ["ZA", "0800 456 789"],
        ] as const) {
            const r = getCrisisResourcesForCountry(code);
            expect(r.countryCode, code).toBe(code);
            expect(JSON.stringify(r.primary), `${code} lost its own line`).toContain(expected);
        }
    });

    it("is case- and whitespace-insensitive, because headers and locales are not tidy", () => {
        expect(getCrisisResourcesForCountry("in")).toBe(INDIA_CRISIS_RESOURCES);
        expect(getCrisisResourcesForCountry(" us ")).toBe(getCrisisResourcesForCountry("US"));
    });
});

describe("⛔ the international fallback invents no phone number", () => {
    it("carries a URL and no dialable number", () => {
        // 112 is wrong in the US and much of Asia; 911 is wrong across most of
        // Europe and Africa. Printing either would be a confident lie.
        const r = INTERNATIONAL_CRISIS_RESOURCES;
        expect(r.emergency).toBeUndefined();
        for (const line of r.primary) {
            expect(line.url, "a fallback line must be reachable by URL").toBeTruthy();
            expect(line.contact).not.toMatch(/^\s*(\+?\d|1\d\d\b)/);
        }
    });

    it("🔑 and every renderer prefers that URL over a tel: link", () => {
        // A `tel:` built from "findahelpline.com" strips to nothing and dials
        // nothing. Pinned as source text because the alternative is rendering
        // three React trees to assert one href.
        const chat = read("src/app/chat/page.tsx");
        expect(chat).toMatch(/primaryLine\.url \?/);
        // The tel: branch must still exist for the 59 countries that have real
        // numbers — a blunt fix here would have broken those instead.
        expect(chat).toMatch(/href=\{`tel:\$\{primaryLine\.contact/);
    });
});

describe("🌍 the public FAQ is not written as though India were the only country", () => {
    const faq = read("src/data/faq.ts");
    const page = read("src/app/faq/page.tsx");

    it("the crisis answer names the worldwide directory as well as the Indian lines", () => {
        // ⚠️ This page is indexed globally and a third of its impressions
        // already come from AI surfaces, which quote one answer with no page
        // around it. An India-only answer travels as a global one.
        const crisis = faq.match(/id: "crisis",[\s\S]*?a: "(.*?)",\n/);
        expect(crisis).toBeTruthy();
        const a = crisis![1];
        expect(a).toMatch(/14416/);                       // India, kept
        expect(a).toMatch(/findahelpline\.com/);          // everyone else
        expect(a).toMatch(/your own country|for your own country/i);
    });

    it("and so is the page footer", () => {
        expect(page).toMatch(/findahelpline\.com/);
        expect(page).toMatch(/in your own country/i);
    });
});
