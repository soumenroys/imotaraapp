/**
 * 🔴 "i tried to talk in bengali but it typed in hindi."
 *
 * The Whisper API REJECTS Bengali as a `language` value. Production said so
 * on every attempt, 2026-10-10:
 *
 *   Whisper 400: {"message":"Language 'bn' is not supported.",
 *                 "code":"unsupported_language"}
 *   [voice/transcribe] Whisper rejected language "bn" — retrying with
 *                      auto-detect. Remove it from WHISPER_LANGS.
 *
 * An earlier change had added bn/te/ml/gu/pa with the comment "Whisper
 * supports all five". The MODEL does; the API's `language` PARAMETER does
 * not, and that is what this route sends. Every Bengali turn therefore cost a
 * wasted 400 and then fell back to bare auto-detect, which returned
 * Devanagari for Bengali speech.
 *
 * 🔑 With `language` unavailable, the only remaining lever is Whisper's
 * `prompt`: it biases output toward the script of the prompt text.
 */

import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import {
    WHISPER_LANGS, SCRIPT_PROMPTS, scriptPromptFor, whisperLanguageFor, isLikelyHallucination,
} from "../app/api/voice/transcribe/route";

const SRC = fs.readFileSync(
    path.join(process.cwd(), "src/app/api/voice/transcribe/route.ts"), "utf8");

describe("🔴 the codes the API actually rejects are not sent", () => {
    it("⛔ bn is NOT offered as a language — production 400s on it", () => {
        expect(WHISPER_LANGS.has("bn")).toBe(false);
        expect(whisperLanguageFor("bn")).toBeNull();
    });

    it("the other Indic scripts the API does not take are also absent", () => {
        for (const l of ["gu", "te", "ml", "pa", "or"]) {
            expect(WHISPER_LANGS.has(l), `${l} must not be sent as language`).toBe(false);
        }
    });

    it("⚖️ the Indic languages the API DOES take are still sent", () => {
        // Removing these would throw away a working hint for no reason.
        for (const l of ["hi", "mr", "ta", "kn", "ur", "ne"]) {
            expect(whisperLanguageFor(l), `${l} must still be sent`).toBe(l);
        }
    });

    it("…and the foreign languages are untouched", () => {
        for (const l of ["en", "ar", "he", "ru", "zh", "ja", "es", "fr", "de", "pt", "id"]) {
            expect(whisperLanguageFor(l), l).toBe(l);
        }
    });
});

describe("🔑 a script prompt replaces the hint we cannot send", () => {
    it("every rejected language has one, in its own script", () => {
        const ranges: Record<string, RegExp> = {
            bn: /[ঀ-৿]/, gu: /[઀-૿]/, te: /[ఀ-౿]/,
            ml: /[ഀ-ൿ]/, pa: /[਀-੿]/, or: /[଀-୿]/,
        };
        for (const [lang, re] of Object.entries(ranges)) {
            const p = scriptPromptFor(lang);
            expect(p, `${lang} needs a script prompt`).toBeTruthy();
            expect(re.test(p), `${lang} prompt must be in its own script`).toBe(true);
        }
    });

    it("⛔ no script prompt for languages whose real hint works", () => {
        // Sending both would be noise; `language` is the stronger signal.
        for (const l of ["en", "hi", "ta", "mr", "kn", "ur"]) {
            expect(scriptPromptFor(l), l).toBe("");
        }
    });

    it("degenerate input yields no prompt rather than throwing", () => {
        for (const v of ["", null, undefined, 42, {}]) {
            expect(scriptPromptFor(v as unknown)).toBe("");
        }
    });

    it("a BCP-47 tag still finds its script prompt", () => {
        expect(scriptPromptFor("bn-IN")).toBe(SCRIPT_PROMPTS.bn);
    });

    it("⛔ the two lists never overlap — one hint per language, never both", () => {
        // The invariant behind the `WHISPER_LANGS.has(code)` guard in
        // scriptPromptFor. A language in BOTH lists would send `language`
        // AND a script prompt, which is noise at best and contradictory at
        // worst. Asserted as data so adding an entry to either list cannot
        // quietly create the overlap.
        const both = Object.keys(SCRIPT_PROMPTS).filter((l) => WHISPER_LANGS.has(l));
        expect(both).toEqual([]);
    });
});

describe("⛔ the echo guard must check the prompt we ACTUALLY sent", () => {
    it("the combined prompt is what reaches the hallucination check", () => {
        // Whisper echoes its prompt verbatim when it hears nothing. If the
        // guard checked only the companion name, an echo of the SCRIPT hint
        // would be accepted as if the person had spoken it.
        expect(SRC).toMatch(/isLikelyHallucination\(rawText, effectivePrompt\)/);
        expect(SRC).toMatch(/whisperForm\.append\("prompt", effectivePrompt\)/);
    });

    it("an echo of the combined prompt is still recognised", () => {
        const combined = `Imotara. ${SCRIPT_PROMPTS.bn}`;
        expect(isLikelyHallucination(combined, combined)).toBe(true);
    });

    it("…while real speech in that script is NOT discarded", () => {
        // The regression that would matter most: silencing Bengali entirely.
        const combined = `Imotara. ${SCRIPT_PROMPTS.bn}`;
        expect(isLikelyHallucination("আমার আজ খুব ক্লান্ত লাগছে", combined)).toBe(false);
    });
});
