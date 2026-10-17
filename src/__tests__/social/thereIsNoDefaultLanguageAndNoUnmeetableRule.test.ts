/**
 * ⛔ TWO GUARDS THAT HAD NO TEST, AND SO WERE NOT GUARDS.
 *
 * 🔴 BOTH FOUND BY A MUTATION RUN, not by reading the code. Deleting either one
 * left the whole social suite green, which means both were decorative
 * ⇒ trap_mutation_harness_can_report_false_caught.
 *
 *   1. `assertPostableLanguage` refuses a missing language instead of falling
 *      back to English. Elsewhere in this codebase `concreteLang('auto')`
 *      resolves to 'en', which is right for a reply — one has to come out in
 *      some language. It is wrong here: a schedule whose language went missing
 *      would post in English on brand channels for months and look perfectly
 *      healthy doing it ⇒ trap_concretelang_turns_auto_into_en.
 *
 *   2. The recency preference has to be arithmetically meetable. "No palette
 *      among the last N" needs more than N palettes, and the first version of
 *      this design said fourteen days with six palettes.
 */

import { describe, it, expect } from "vitest";
import * as languages from "@/lib/social/languages";
import {
    assertPostableLanguage,
    isSupportedLanguage,
    SOCIAL_LANGUAGE_CODES,
} from "@/lib/social/languages";
import {
    assertAxesSupportWindow,
    PALETTE_NAMES,
    LAYOUTS,
    RECENT_WINDOW,
} from "@/lib/social/visualRecipe";

describe("there is no default language", () => {
    it("refuses nothing at all rather than choosing English", () => {
        for (const missing of [undefined, null, ""]) {
            expect(
                () => assertPostableLanguage(missing),
                `a missing language was accepted as ${JSON.stringify(missing)}`,
            ).toThrow();
        }
    });

    it("says why, naming the failure rather than the value", () => {
        // ⚠️ "invalid input" would send the next person looking at the caller.
        // The message has to say that the absence of a default is deliberate.
        let message = "";
        try {
            assertPostableLanguage(undefined);
        } catch (e) {
            message = (e as Error).message;
        }
        expect(message).toMatch(/no default/i);
        expect(message).toMatch(/english/i);
    });

    it("refuses a language this product does not speak", () => {
        for (const wrong of ["ko", "EN", "en-GB", "xx", "english"]) {
            expect(() => assertPostableLanguage(wrong), `${wrong} was accepted`).toThrow();
        }
    });

    it("returns the code unchanged for every one of the 22", () => {
        for (const code of SOCIAL_LANGUAGE_CODES) {
            expect(assertPostableLanguage(code)).toBe(code);
            expect(isSupportedLanguage(code)).toBe(true);
        }
    });

    it("exports no function that would supply a default", () => {
        /**
         * ⛔ Structural, and the part that survives a refactor. The risk is not
         * that somebody edits the throw — it is that somebody adds a
         * `resolveLanguage()` next to it, because that is what the rest of the
         * codebase has, and then calls that instead.
         */
        const tempting = Object.keys(languages).filter((k) =>
            /^(resolve|default|coerce|fallback|ensure)/i.test(k),
        );
        expect(
            tempting,
            `these would let a caller get a language without asserting one: ${tempting.join(", ")}`,
        ).toEqual([]);
    });
});

describe("the recency rule has to be meetable", () => {
    it("throws when there are no more palettes than the window", () => {
        expect(() => assertAxesSupportWindow(5, 8, 5)).toThrow();
        expect(() => assertAxesSupportWindow(3, 8, 5)).toThrow();
    });

    it("throws when there are no more layouts than the window", () => {
        expect(() => assertAxesSupportWindow(6, 5, 5)).toThrow();
    });

    it("passes when both axes are larger than the window", () => {
        expect(() => assertAxesSupportWindow(6, 8, 5)).not.toThrow();
    });

    it("says what to do about it", () => {
        let message = "";
        try {
            assertAxesSupportWindow(4, 8, 5);
        } catch (e) {
            message = (e as Error).message;
        }
        // ⚠️ A bare "invariant violated" leaves the reader to rediscover the
        // arithmetic. The numbers and the remedy both belong in the message.
        expect(message).toMatch(/4 /);
        expect(message).toMatch(/lower the window|add an axis/i);
    });

    it("the shipped axes satisfy the shipped window", () => {
        /**
         * 🔑 THIS IS THE REAL GUARD, and it is worth saying why.
         *
         * A mutation run reports that deleting the `assertAxesSupportWindow`
         * CALL inside `pickRecipe` breaks no test, and that looks like a hole.
         * It is an equivalent mutant. The thing the invariant exists to catch
         * is somebody shrinking an axis below the window — and this assertion
         * catches that at test time whether or not the runtime call is there.
         * Verified by shrinking the palettes to four with the call present and
         * with it absent: the suite goes red both ways.
         *
         * ⚠️ So the runtime call is belt-and-braces for anyone importing this
         * module outside the test suite, and ⛔ no test should be contrived to
         * pin it — that would mean mutating a shared exported constant at
         * runtime, which is worse than the thing it proves.
         */
        expect(() =>
            assertAxesSupportWindow(PALETTE_NAMES.length, LAYOUTS.length, RECENT_WINDOW),
        ).not.toThrow();
    });
});
