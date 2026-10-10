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

    it("⚠️ …but ONLY bn — the others were removed on inference and are back", () => {
        // CORRECTION, same day. The first version of this change also dropped
        // gu/te/ml/pa because they "looked like" bn. Production had only ever
        // rejected bn — the other four were removed on inference, throwing
        // away a working hint for languages nobody had reported a problem
        // with.
        //
        // ⛔ Do not remove a code without a LOGGED rejection naming it. The
        // route's retry handles an unexpected rejection gracefully, so a
        // doubtful code costs one wasted round-trip; a wrongly removed one
        // costs permanently worse transcription.
        for (const l of ["gu", "te", "ml", "pa"]) {
            expect(WHISPER_LANGS.has(l)).toBe(true);
        }
        // Odia was never in the set, and that predates today.
        expect(WHISPER_LANGS.has("or")).toBe(false);
    });

    it("⚖️ every Indic language the API DOES take is still sent", () => {
        // Removing any of these would throw away a working hint for no reason.
        for (const l of ["hi", "mr", "ta", "kn", "ur", "ne", "gu", "te", "ml", "pa"]) {
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
    it("the languages with no usable hint get one, in their own script", () => {
        // Only those NOT in WHISPER_LANGS: bn (rejected by the API) and or
        // (never in it — the route has always said Whisper has no "or").
        const ranges: Record<string, RegExp> = {
            bn: /[\u0980-\u09FF]/, or: /[\u0B00-\u0B7F]/,
        };
        for (const [lang, re] of Object.entries(ranges)) {
            const q = scriptPromptFor(lang);
            expect(q, `${lang} needs a script prompt`).toBeTruthy();
            expect(re.test(q), `${lang} prompt must be in its own script`).toBe(true);
        }
    });

    it("⚖️ a language WITH a working hint gets no script prompt", () => {
        // The hint is the stronger signal; sending both is noise. These four
        // were removed on inference earlier today and are restored.
        for (const l of ["gu", "te", "ml", "pa"]) {
            expect(scriptPromptFor(l), l).toBe("");
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

    it("⛔ a language is never given BOTH a hint and a script prompt", () => {
        // The real invariant. SCRIPT_PROMPTS deliberately keeps entries for
        // languages that are currently accepted (gu/te/ml/pa) so the data is
        // ready if OpenAI ever rejects one — the route's retry would then
        // need it. What must never happen is sending both signals at once,
        // which scriptPromptFor guarantees by checking WHISPER_LANGS first.
        for (const l of Object.keys(SCRIPT_PROMPTS)) {
            if (WHISPER_LANGS.has(l)) {
                expect(scriptPromptFor(l), `${l} has a hint, so no script prompt`).toBe("");
            } else {
                expect(scriptPromptFor(l), `${l} has no hint, so it needs one`).toBeTruthy();
            }
        }
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
