/**
 * ⛔ THE WORDMARK MAP IN THE PICTURE COMPOSER MUST AGREE WITH THE SHIPPED COPY.
 *
 * 🔴 THIS IS A SIXTH SURFACE FOR THE BRAND NAME, and the fifth one drifted.
 *
 * On 17 Oct 2026 the Urdu voice preview said اموتارا as امتارا — the و missing,
 * so the spoken name lost its "o" — and the Kannada preview was a vowel short.
 * In both cases sixteen-plus written occurrences agreed and two separately
 * written maps disagreed, because nobody compared them and nobody here reads
 * either language. ⇒ brand_name_in_native_scripts
 *
 * 🔑 THE GENERALISABLE PART, which is why this file exists rather than a note
 * asking the next person to be careful: cross-surface comparison finds language
 * defects that neither a test nor a reviewer lacking the language ever will. It
 * needs none of the 22 languages. It only asks whether they agree.
 *
 * ⛔ IT CANNOT TELL YOU A SPELLING IS RIGHT. They could all be wrong together.
 * That still needs a native speaker
 * ⇒ native_speakers_should_audit_real_replies.
 *
 * ⚠️ AND THE STAKES ARE HIGHER HERE than on an in-app screen. This map sets the
 * name on a PUBLISHED PICTURE, which is permanent, screenshot and quoted. A
 * misspelled brand name in its own script, on the channel where speakers of
 * that language would see it, is the single worst version of this defect.
 */

import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { BRAND_IN_SCRIPT, SOCIAL_LANGUAGE_CODES } from "@/lib/social/languages";

const ROOT = process.cwd();

/**
 * The map is compared against the guard that already pins every other surface,
 * read as TEXT rather than imported.
 *
 * 🔑 Reading it as text is deliberate. Importing a shared constant would make
 * both files agree by construction and assert nothing — the mirror-test failure
 * ⇒ trap_a_mirror_test_cannot_catch_a_refactor. Two independently written
 * copies that must match is the only arrangement that can catch a drift.
 */
const SHIPPED_GUARD = "src/__tests__/theBrandIsSpelledTheSameEverywhere.test.ts";

function shippedForms(): Record<string, string> {
    const src = fs.readFileSync(path.join(ROOT, SHIPPED_GUARD), "utf8");
    const block = /const BRAND_BY_LANGUAGE[^=]*=\s*\{([\s\S]*?)\n\};/.exec(src);
    if (!block) throw new Error(`${SHIPPED_GUARD} no longer declares BRAND_BY_LANGUAGE — this guard is blind`);

    const out: Record<string, string> = {};
    for (const line of block[1].split("\n")) {
        const m = /^\s*"?([a-z/]+)"?\s*:\s*"([^"]+)"/.exec(line);
        if (!m) continue;
        for (const code of m[1].split("/")) out[code] = m[2];
    }
    return out;
}

describe("the social wordmark agrees with the shipped copy", () => {
    const shipped = shippedForms();

    it("the guard it compares against is actually readable", () => {
        // ⛔ Without this, a rename or a reformat turns the whole file into a
        // test that parses nothing and passes ⇒ the parse must be pinned too.
        expect(Object.keys(shipped).length, "parsed no brand forms at all").toBeGreaterThanOrEqual(22);
        expect(shipped.bn).toBeTruthy();
        expect(shipped.ur).toBeTruthy();
    });

    for (const code of ["bn", "hi", "mr", "ta", "te", "gu", "pa", "kn", "ml", "or", "ur", "ar", "he", "ja"]) {
        it(`${code} is spelled the same in both`, () => {
            expect(
                BRAND_IN_SCRIPT[code],
                `the picture composer spells the brand differently from every other surface in ${code}`,
            ).toBe(shipped[code]);
        });
    }

    it("the Latin-script languages keep the Latin form", () => {
        for (const code of ["en", "es", "fr", "pt", "de", "ru", "id", "zh"]) {
            expect(BRAND_IN_SCRIPT[code], `${code} should carry the Latin form`).toBe("Imotara");
        }
    });

    it("covers all 22, so no language composes a picture with no name on it", () => {
        const missing = SOCIAL_LANGUAGE_CODES.filter((c) => !BRAND_IN_SCRIPT[c]);
        expect(missing, `no wordmark for: ${missing.join(", ")}`).toEqual([]);
    });

    it("no two languages share a form unless they share a script", () => {
        /**
         * ⚠️ hi and mr share Devanagari, and the eight Latin-script languages
         * share "Imotara". Anything else sharing a form means one was
         * copy-pasted from its neighbour — which is how a wrong spelling
         * spreads rather than being noticed.
         */
        const allowed = new Set(["इमोतारा", "Imotara"]);
        const byForm = new Map<string, string[]>();
        for (const [code, form] of Object.entries(BRAND_IN_SCRIPT)) {
            byForm.set(form, [...(byForm.get(form) ?? []), code]);
        }
        for (const [form, codes] of byForm) {
            if (codes.length > 1 && !allowed.has(form)) {
                expect.fail(`${codes.join(" and ")} share the form "${form}" but not a script`);
            }
        }
    });
});
