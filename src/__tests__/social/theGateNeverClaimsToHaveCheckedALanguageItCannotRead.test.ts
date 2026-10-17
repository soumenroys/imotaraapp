/**
 * ⛔ THE GATE MUST NOT REPORT "CHECKED" FOR A LANGUAGE IT HAS NO WORDS FOR.
 *
 * 🔴 THE FAILURE SHAPE THIS PINS. The tempting way to satisfy "posts should not
 * include any abusive words" in 22 languages is to write a list for each and
 * move on. In the 19 nobody here reads, that list would be invisibly wrong —
 * and far worse than absent, because the result reports success.
 *
 * 🔑 It is the same shape as the Urdu and Kannada brand-spelling defects of
 * 17 Oct 2026: every file internally consistent, every check green, and the
 * error only visible BETWEEN files to somebody who could read the language.
 * ⇒ theBrandIsSpelledTheSameEverywhere.test.ts, brand_name_in_native_scripts
 *
 * ⇒ So an unauthored list is reported in `listsUnavailable`, and unattended
 * posting is refused for that language. ⚠️ That is a real narrowing: today it
 * means auto-publish is English-only. The remedy is a dozen words from a
 * speaker, which is cheaper than the alternative.
 */

import { describe, it, expect } from "vitest";
import { checkVoice, canAutoPublishIn, GATE_VOCABULARY } from "@/lib/social/voiceGate";
import { SOCIAL_LANGUAGE_CODES, REVIEWED_LANGUAGES } from "@/lib/social/languages";

describe("what the gate admits it did not check", () => {
    it("reports the abuse list as unavailable in every language that has none", () => {
        for (const code of SOCIAL_LANGUAGE_CODES) {
            const result = checkVoice("A plain sentence about nothing in particular.", code);
            const authored = (GATE_VOCABULARY.ABUSE_BY_LANGUAGE[code] ?? []).length > 0;

            if (authored) {
                expect(result.listsRun, `${code} has a list but did not run it`).toContain("abuse");
                expect(result.listsUnavailable).not.toContain("abuse");
            } else {
                expect(
                    result.listsUnavailable,
                    `${code} has no abuse list, and the gate did not say so`,
                ).toContain("abuse");
                expect(result.listsRun).not.toContain("abuse");
            }
        }
    });

    it("never reports a list as both run and unavailable", () => {
        for (const code of SOCIAL_LANGUAGE_CODES) {
            const r = checkVoice("Something plainly said.", code);
            const both = r.listsRun.filter((l) => r.listsUnavailable.includes(l));
            expect(both, `${code} reported ${both.join(", ")} as both run and unavailable`).toEqual([]);
        }
    });

    it("runs the clinical list in every language, because the claim is usually in English anyway", () => {
        // ⚠️ "AI therapist" turns up inside otherwise non-English marketing copy
        // constantly. Skipping the clinical list for non-English posts would
        // leave the single most consequential check off for 21 of 22 languages.
        for (const code of SOCIAL_LANGUAGE_CODES) {
            expect(checkVoice("x", code).listsRun).toContain("clinical");
        }
        expect(checkVoice("Hamara AI therapist aapke saath hai.", "hi").ok).toBe(false);
    });
});

describe("which languages may post with nobody reading", () => {
    it("refuses every language nobody here reads", () => {
        for (const code of SOCIAL_LANGUAGE_CODES) {
            if (REVIEWED_LANGUAGES.has(code)) continue;
            const verdict = canAutoPublishIn(code);
            expect(verdict.ok, `${code} may post unattended and nobody here reads it`).toBe(false);
            expect(verdict.reason, `${code} was refused without saying why`).toBeTruthy();
        }
    });

    it("refuses a reviewed language that still has no abuse list", () => {
        /**
         * 🔑 THE CASE THAT PROVES THE TWO CONDITIONS ARE SEPARATE. Bengali and
         * Hindi are read by somebody here, so condition one passes — and they
         * are still refused, because the words to check against do not exist.
         * ⛔ If this test ever starts failing because the conditions were
         * collapsed into one, the owner's instruction that posts carry no
         * abusive words stops being checkable in those languages.
         */
        for (const code of ["bn", "hi"]) {
            expect(REVIEWED_LANGUAGES.has(code), `${code} should be a reviewed language`).toBe(true);
            const verdict = canAutoPublishIn(code);
            expect(verdict.ok, `${code} was allowed to post unattended with no abuse list`).toBe(false);
            expect(verdict.reason).toMatch(/abuse|profanity/i);
        }
    });

    it("allows exactly the languages that clear both conditions", () => {
        const allowed = SOCIAL_LANGUAGE_CODES.filter((c) => canAutoPublishIn(c).ok);
        // ⚠️ Pinned as an exact set rather than a count: the number says nothing
        // about which, and "one language" passing would be satisfied by the
        // wrong one.
        expect(allowed).toEqual(["en"]);
    });

    it("refuses a code that is not one of the 22 at all", () => {
        expect(canAutoPublishIn("ko").ok).toBe(false);
        expect(canAutoPublishIn("").ok).toBe(false);
    });
});

describe("the careless-language list", () => {
    it("catches the sentence that gets screenshot", () => {
        const r = checkVoice("The response times are crazy good.", "en");
        expect(r.ok).toBe(false);
        expect(r.findings.some((f) => f.list === "careless" && f.matched === "crazy")).toBe(true);
    });

    it("catches unsafe suicide phrasing", () => {
        const r = checkVoice("Every year too many people commit suicide.", "en");
        expect(r.findings.some((f) => f.list === "careless" && f.matched === "commit suicide")).toBe(true);
    });

    it("catches manufactured engagement and streak language", () => {
        expect(checkVoice("What do you think? Comment below.", "en").ok).toBe(false);
        expect(checkVoice("Keep your streak going — only today.", "en").ok).toBe(false);
    });

    it("does not fire on the words it borrows when they are used properly", () => {
        // 🔑 "mental health" is the category. If the list reached for the bare
        // word "mental" the gate would reject every honest post.
        expect(checkVoice("Mental health support in 22 languages.", "en").ok).toBe(true);
    });
});
