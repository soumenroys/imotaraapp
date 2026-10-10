/**
 * 🔴 "i tried to talk in bengali but it typed in hindi."
 *
 * Which language codes each STT model's API actually accepts, and what we do
 * for the ones it refuses.
 *
 * ⚠️ THIS FILE HAS BEEN WRONG TWICE IN ONE DAY, in opposite directions, and
 * both times because someone reasoned about the set instead of asking the API.
 *
 *   1. bn/te/gu/ml/pa were listed as supported, on the strength of a code
 *      comment saying "Whisper supports all five". The MODEL does; the
 *      `language` PARAMETER does not. Every Bengali turn cost a wasted 400 and
 *      fell back to bare auto-detect, which returned Devanagari for Bengali
 *      speech — the reported bug.
 *
 *   2. They were removed, and then gu/te/ml/pa were RESTORED with the
 *      reasoning that "production had only ever logged a rejection for bn".
 *      It had only logged bn because nobody had yet spoken Gujarati into it.
 *
 * 🔑 All four are rejected. Measured 2026-10-10 by sending each of the 22 app
 * languages to both models:
 *
 *      code   gpt-transcribe   whisper-1
 *      bn     ✅ accepted      ❌ Language 'bn' is not supported.
 *      te     ✅ accepted      ❌ Language 'te' is not supported.
 *      gu     ✅ accepted      ❌ Language 'gu' is not supported.
 *      ml     ✅ accepted      ❌ Language 'ml' is not supported.
 *      pa     ❌ not recognized  ❌ Language 'pa' is not supported.
 *      or     ❌ not recognized  ❌ Language 'or' is not supported.
 *      (the other 16 app languages: accepted by both)
 *
 * ⛔ Do not edit either set from a log, a comment, or a memory of what OpenAI
 * documents. A log tells you what somebody happened to try. Ask the API.
 */

import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import type { SttModel } from "../app/api/voice/transcribe/route";
import {
    WHISPER_LANGS, GPT_TRANSCRIBE_LANGS, SCRIPT_PROMPTS, scriptPromptFor,
    whisperLanguageFor, isLikelyHallucination, langsFor, langsNameFor,
    STT_PRIMARY, STT_FALLBACK, responseFormatFor,
} from "../app/api/voice/transcribe/route";

const SRC = fs.readFileSync(
    path.join(process.cwd(), "src/app/api/voice/transcribe/route.ts"), "utf8");

/** The hint this model would send for this language, or null. */
const hint = (lang: string, model: SttModel = STT_PRIMARY) =>
    whisperLanguageFor(lang, model);

describe("🔴 the codes each API rejects are not sent to it", () => {
    it("⛔ whisper-1 gets none of bn/te/gu/ml/pa/or — all six are refused", () => {
        for (const l of ["bn", "te", "gu", "ml", "pa", "or"]) {
            expect(WHISPER_LANGS.has(l), `${l} must not be in WHISPER_LANGS`).toBe(false);
            expect(hint(l, STT_FALLBACK), `${l} must not be sent to whisper-1`).toBeNull();
        }
    });

    it("🔑 gpt-transcribe DOES take bn/te/gu/ml — that is the upgrade", () => {
        // The reason the model switch is more than a quality tweak: for these
        // four we can finally TELL the model what language it is hearing,
        // which is a stronger signal than any script prompt.
        for (const l of ["bn", "te", "gu", "ml"]) {
            expect(GPT_TRANSCRIBE_LANGS.has(l), `${l} must be in GPT_TRANSCRIBE_LANGS`).toBe(true);
            expect(hint(l), `${l} must be sent to gpt-transcribe`).toBe(l);
        }
    });

    it("⛔ …but NOT pa or or — both models refuse those two", () => {
        for (const l of ["pa", "or"]) {
            expect(GPT_TRANSCRIBE_LANGS.has(l), l).toBe(false);
            expect(WHISPER_LANGS.has(l), l).toBe(false);
            expect(hint(l), l).toBeNull();
            expect(hint(l, STT_FALLBACK), l).toBeNull();
        }
    });

    it("⚖️ every language BOTH models accept is still sent to both", () => {
        // Removing any of these would throw away a working hint for no reason.
        const both = ["en", "hi", "mr", "ta", "kn", "ur",
                      "ar", "he", "ru", "zh", "ja", "es", "fr", "de", "pt", "id"];
        for (const l of both) {
            expect(hint(l), `${l} -> gpt-transcribe`).toBe(l);
            expect(hint(l, STT_FALLBACK), `${l} -> whisper-1`).toBe(l);
        }
    });

    it("🔑 the new model's set is a strict superset of the old one", () => {
        // The invariant that makes the fallback safe: falling back can only
        // ever lose a hint, never gain an invalid one.
        for (const l of WHISPER_LANGS) {
            expect(GPT_TRANSCRIBE_LANGS.has(l), `${l} missing from the new set`).toBe(true);
        }
        expect(GPT_TRANSCRIBE_LANGS.size).toBe(WHISPER_LANGS.size + 4);
    });

    it("langsFor routes each model to its own set", () => {
        expect(langsFor(STT_PRIMARY)).toBe(GPT_TRANSCRIBE_LANGS);
        expect(langsFor(STT_FALLBACK)).toBe(WHISPER_LANGS);
        expect(langsNameFor(STT_PRIMARY)).toBe("GPT_TRANSCRIBE_LANGS");
        expect(langsNameFor(STT_FALLBACK)).toBe("WHISPER_LANGS");
    });
});

describe("🔑 a script prompt replaces the hint we cannot send", () => {
    it("⛔ pa and or — refused by both models — always get one", () => {
        const ranges: Record<string, RegExp> = {
            pa: /[਀-੿]/, or: /[଀-୿]/,
        };
        for (const [lang, re] of Object.entries(ranges)) {
            for (const model of [STT_PRIMARY, STT_FALLBACK] as const) {
                const q = scriptPromptFor(lang, hint(lang, model));
                expect(q, `${lang} needs a script prompt on ${model}`).toBeTruthy();
                expect(re.test(q), `${lang} prompt must be in its own script`).toBe(true);
            }
        }
    });

    it("🔑 bn/te/gu/ml need one on the FALLBACK but not on the primary", () => {
        // The whole point of keying this on the code actually sent. The same
        // language needs opposite treatment on the two models.
        for (const [lang, re] of Object.entries({
            bn: /[ঀ-৿]/, te: /[ఀ-౿]/,
            gu: /[઀-૿]/, ml: /[ഀ-ൿ]/,
        })) {
            expect(scriptPromptFor(lang, hint(lang, STT_PRIMARY)),
                `${lang} has a real hint on gpt-transcribe`).toBe("");
            const q = scriptPromptFor(lang, hint(lang, STT_FALLBACK));
            expect(q, `${lang} needs the crutch on whisper-1`).toBeTruthy();
            expect(re.test(q), `${lang} prompt must be in its own script`).toBe(true);
        }
    });

    it("⛔ a language is never given BOTH a hint and a script prompt", () => {
        // The real invariant, and now it cannot be stated per-model because
        // the function keys on the decision itself.
        for (const model of [STT_PRIMARY, STT_FALLBACK] as const) {
            for (const l of Object.keys(SCRIPT_PROMPTS)) {
                const sent = hint(l, model);
                if (sent) {
                    expect(scriptPromptFor(l, sent), `${l}/${model}: hint sent, so no prompt`).toBe("");
                } else {
                    expect(scriptPromptFor(l, sent), `${l}/${model}: no hint, so needs one`).toBeTruthy();
                }
            }
        }
    });

    it("🔴 a RUNTIME rejection still gets the crutch, though the table says otherwise", () => {
        // ⚠️ THE CASE THE FIRST VERSION GOT WRONG. scriptPromptFor originally
        // took the model and re-derived the answer from langsFor(model) — right
        // on the happy path, wrong on the one that matters. When the API
        // rejects a code the table claims it accepts, the retry sends no hint,
        // and the script prompt is the only signal left. Keyed on the model,
        // it returned "" and the retry free-ran; keyed on the code actually
        // sent, it returns the prompt.
        expect(scriptPromptFor("bn", null)).toBe(SCRIPT_PROMPTS.bn);
        expect(scriptPromptFor("te", null)).toBe(SCRIPT_PROMPTS.te);
    });

    it("⛔ no script prompt for languages whose real hint works on both", () => {
        for (const l of ["en", "hi", "ta", "mr", "kn", "ur"]) {
            expect(scriptPromptFor(l, hint(l)), l).toBe("");
            expect(scriptPromptFor(l, hint(l, STT_FALLBACK)), l).toBe("");
        }
    });

    it("degenerate input yields no prompt rather than throwing", () => {
        for (const v of ["", null, undefined, 42, {}]) {
            expect(scriptPromptFor(v as unknown, null)).toBe("");
        }
    });

    it("a BCP-47 tag still finds its script prompt", () => {
        expect(scriptPromptFor("bn-IN", null)).toBe(SCRIPT_PROMPTS.bn);
        expect(scriptPromptFor("pa-IN", hint("pa-IN"))).toBe(SCRIPT_PROMPTS.pa);
    });
});

describe("⛔ the echo guard must check the prompt we ACTUALLY sent", () => {
    it("the combined prompt is what reaches the hallucination check", () => {
        // These models echo their prompt verbatim when they hear nothing. If
        // the guard checked only the companion name, an echo of the SCRIPT
        // hint would be accepted as if the person had spoken it.
        expect(SRC).toMatch(/isLikelyHallucination\(rawText, effectivePrompt\)/);
        expect(SRC).toMatch(/form\.append\("prompt", prompt\)/);
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

describe("🔑 the prompt must bias the WORDS, not only the script", () => {
    // 🔴 Reported 2026-10-10: "the words which are getting typed in bengali,
    // those words does not exists in bengali dictionary."
    //
    // The prompt conditions the decoder's vocabulary, so what it contains is
    // what the model becomes readier to produce. A single short sentence
    // biased the script and almost nothing else.
    //
    // ⚖️ Still only a lever. The real fix for Bengali was the model — these
    // prompts now matter mainly for pa/or, and for bn/te/gu/ml on the
    // fallback path.

    it("every script prompt carries real sentences, not a token phrase", () => {
        for (const [lang, text] of Object.entries(SCRIPT_PROMPTS)) {
            if (text.length <= 40) throw new Error(`${lang} prompt is too thin to condition anything`);
        }
    });

    it("…and more than one sentence, so it spans some grammar", () => {
        for (const [lang, text] of Object.entries(SCRIPT_PROMPTS)) {
            const sentences = text.split(/[।.?!॥]/).filter((t) => t.trim().length > 2);
            if (sentences.length < 3) throw new Error(`${lang} needs several sentences`);
        }
    });

    it("⚖️ they are about FEELINGS — the vocabulary this product hears", () => {
        // A prompt about the weather would bias toward the wrong words.
        // Each carries a question form too, since people are asked how they are.
        for (const [lang, text] of Object.entries(SCRIPT_PROMPTS)) {
            if (!text.includes("?")) throw new Error(`${lang} should include a question`);
        }
    });

    it("⛔ still short enough to stay well inside the prompt budget", () => {
        // ~224 tokens. These are far below it, but an unbounded prompt would
        // start displacing the audio's own context.
        for (const [lang, text] of Object.entries(SCRIPT_PROMPTS)) {
            if (text.length >= 220) throw new Error(`${lang} prompt is getting long`);
        }
    });

    it("⛔ an echo of the longer prompt is STILL caught", () => {
        // Longer prompts make the echo guard more important, not less: there
        // is more text to be handed back as if someone had said it.
        const combined = `Imotara. ${SCRIPT_PROMPTS.bn}`;
        expect(isLikelyHallucination(combined, combined)).toBe(true);
    });

    it("…and real speech in that script is still NOT discarded", () => {
        const combined = `Imotara. ${SCRIPT_PROMPTS.bn}`;
        expect(isLikelyHallucination("আমার আজ খুব ক্লান্ত লাগছে", combined)).toBe(false);
    });
});

describe("⚠️ the response format differs per model, and the guard depends on it", () => {
    it("the fallback keeps verbose_json — it still needs no_speech_prob", () => {
        expect(responseFormatFor(STT_FALLBACK)).toBe("verbose_json");
    });

    it("🔴 the primary CANNOT have it — the API refuses", () => {
        // Measured: "response_format 'verbose_json' is not compatible with
        // model 'gpt-transcribe-api-ev3'. Use 'json' or 'text' instead."
        expect(responseFormatFor(STT_PRIMARY)).toBe("json");
    });
});
