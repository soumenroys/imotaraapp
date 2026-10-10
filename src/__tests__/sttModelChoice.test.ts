/**
 * WHICH speech-to-text model, and why the obvious-looking one is wrong.
 *
 * 🔴 THE REPORT. 2026-10-10: "the words which are getting typed in bengali,
 * those words does not exists in bengali dictionary. also there is no
 * consideration of bengali grammer or person or gender detection during
 * typing… i fear it will happen for all indian languages as well."
 *
 * Correct. whisper-1 was producing strings that are not words. Measured the
 * same day by speaking each clip at the API, three models side by side:
 *
 *   spoken   আমার আজ খুব ক্লান্ত লাগছে        (bn, "I feel very tired today")
 *     whisper-1        আমার আজ খুব ট্লান তো লাগ্ছে   ❌ ট্লান, লাগ্ছে: not words
 *     gpt-4o-transcribe ✅
 *     gpt-transcribe    ✅
 *
 *   spoken   আমি ভালো নেই, মন খারাপ লাগছে     (bn)
 *     whisper-1        আমি ভালো নে, মন খারাপ লাক্ছে  ❌ নে, লাক্ছে: not words
 *     gpt-4o-transcribe  মোন                          ⚠️ minor
 *     gpt-transcribe    ✅
 *
 *   spoken   मुझे आज बहुत थकान लग रही है      (hi)
 *     whisper-1        बहुत ठकान                     ❌ ठकान: not a word
 *     gpt-4o-transcribe ✅
 *     gpt-transcribe    ✅
 *
 *   spoken   Tamil           all three ✅
 *
 * ⛔ AND THEN THE TEST THAT CHANGED THE ANSWER. This route exists in a product
 * people talk to about how they feel, and its worst failure is not a
 * misspelling — it is putting a sentence nobody said into someone's own
 * history and replying to it warmly. So each model was given four seconds of
 * NO SPEECH, with the Bengali script prompt attached exactly as the route
 * sends it:
 *
 *                       pure silence              faint room noise
 *   whisper-1           gibberish, but            prompt echo, but
 *                       no_speech_prob 0.97       no_speech_prob 0.96
 *                       → the guard catches it    → caught
 *   gpt-4o-transcribe   "আমি ভালো আছি।"            "আমি ভালো আছি।"
 *                       ⛔ invented, and NO        ⛔ invented
 *                          signal to detect it
 *   gpt-transcribe      ""                        ""
 *                       ✅                         ✅
 *
 * 🔑 gpt-4o-transcribe is the better-known name and looked like the upgrade.
 * It would have manufactured "I am well" out of a silent room, in the voice of
 * someone who had said nothing, with nothing in the response able to flag it —
 * because the newer response format has no no_speech_prob at all. That is a
 * regression, not an upgrade, and the only reason it was caught is that the
 * silence case was tested before the switch rather than after.
 *
 * ⛔ DO NOT "modernise" this to gpt-4o-transcribe. Re-run the silence test
 * first if you are ever tempted.
 */

import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import {
    STT_PRIMARY, STT_FALLBACK, responseFormatFor, langsFor, langsNameFor,
    GPT_TRANSCRIBE_LANGS, WHISPER_LANGS,
} from "../app/api/voice/transcribe/route";

const SRC = fs.readFileSync(
    path.join(process.cwd(), "src/app/api/voice/transcribe/route.ts"), "utf8");
const stripComments = (s: string) =>
    s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const CODE = stripComments(SRC);

describe("🔴 the model, and the one it must never become", () => {
    it("the primary is gpt-transcribe", () => {
        expect(STT_PRIMARY).toBe("gpt-transcribe");
    });

    it("⛔ gpt-4o-transcribe appears NOWHERE in the executable code", () => {
        // It hallucinates "আমি ভালো আছি।" out of silence with no detection
        // signal. Comments may discuss it — that is the warning. Code may not.
        expect(CODE).not.toMatch(/gpt-4o-transcribe/);
        expect(CODE).not.toMatch(/gpt-4o-mini-transcribe/);
    });

    it("🔑 the reason is recorded next to the choice, not just in a commit", () => {
        // A future reader with no access to this session must be able to see
        // why the less obvious model was picked, or they will "fix" it.
        expect(SRC).toMatch(/gpt-4o-transcribe/);        // named as rejected
        expect(SRC).toMatch(/no_speech_prob/);
    });
});

describe("🔑 whisper-1 survives as a fallback, not as the main path", () => {
    it("the fallback is whisper-1, and it is a different model", () => {
        expect(STT_FALLBACK).toBe("whisper-1");
        expect(STT_FALLBACK).not.toBe(STT_PRIMARY);
    });

    it("⛔ the first attempt uses the PRIMARY — not the fallback", () => {
        // The failure that would make this whole change a no-op: shipping the
        // new model as something only an error path ever reaches.
        expect(CODE).toMatch(/let model: SttModel = STT_PRIMARY;/);
    });

    it("🔴 a failing primary falls back rather than losing the recording", () => {
        // Someone talking to this app about how they feel must not lose what
        // they just said because a new model had a bad hour.
        expect(CODE).toMatch(/if \(!whisperRes\.ok && model === STT_PRIMARY\) \{/);
        expect(CODE).toMatch(/model = STT_FALLBACK;/);
    });

    it("⚠️ …and a THROWN primary falls back too, not just a bad status", () => {
        // 🔑 The hole the first draft had: the initial fetch's catch block
        // returned 502 immediately, so a network-level failure of the new
        // model — the single most likely way a new model fails — skipped the
        // fallback entirely. It now converts the throw into a status and lets
        // the recovery below run.
        const i = CODE.indexOf("whisperRes = await callStt(whisperForm);");
        expect(i).toBeGreaterThan(-1);
        const firstAttempt = CODE.slice(i, i + 400);
        expect(firstAttempt).toMatch(/catch/);
        expect(firstAttempt).not.toMatch(/return NextResponse\.json/);
        expect(firstAttempt).toMatch(/status: 599/);
    });

    it("⛔ the fallback does not loop — it is tried once", () => {
        // `model === STT_PRIMARY` is the guard. Without it, a whisper-1
        // failure would re-enter and retry whisper-1 forever inside a 60s
        // function budget.
        expect([...CODE.matchAll(/model = STT_FALLBACK;/g)].length).toBe(1);
    });

    it("…and a genuine failure of BOTH still reports failure", () => {
        // Degrading gracefully must not become reporting success.
        expect(CODE).toMatch(/error: "Transcription failed"/);
    });
});

describe("⚠️ the fallback changes three things at once", () => {
    it("the body is REBUILT per attempt, never mutated", () => {
        // 🔑 Why this matters: switching model changes the accepted language
        // codes, the response format, AND therefore whether a script prompt
        // is needed in place of a hint. The bn bug survived its first fix
        // because one of two call sites was patched and the other was not.
        expect(CODE).toMatch(/function buildForm\(model: SttModel, withLanguageHint = true\)/);
        expect([...CODE.matchAll(/built = buildForm\(/g)].length).toBeGreaterThanOrEqual(2);
    });

    it("…so the format follows the model", () => {
        expect(responseFormatFor(STT_PRIMARY)).toBe("json");
        expect(responseFormatFor(STT_FALLBACK)).toBe("verbose_json");
        expect(CODE).toMatch(/form\.append\("response_format", responseFormatFor\(model\)\)/);
    });

    it("…and so does the language table", () => {
        expect(langsFor(STT_PRIMARY)).toBe(GPT_TRANSCRIBE_LANGS);
        expect(langsFor(STT_FALLBACK)).toBe(WHISPER_LANGS);
        expect(CODE).toMatch(/whisperLanguageFor\(lang, model\)/);
    });

    it("…and the log names which table to edit", () => {
        expect(langsNameFor(STT_PRIMARY)).toBe("GPT_TRANSCRIBE_LANGS");
        expect(langsNameFor(STT_FALLBACK)).toBe("WHISPER_LANGS");
        expect(CODE).toMatch(/langsNameFor\(model\)/);
    });

    it("⛔ the model is in every log line, or a fallback is invisible in prod", () => {
        // The 2026-10-10 diagnosis cost hours because the logs said "Whisper"
        // regardless of what had actually run. If the primary starts failing
        // silently and we never learn, we are shipping whisper-1 again.
        const logs = [...CODE.matchAll(/console\.(?:warn|error)\(\s*`?\[voice\/transcribe\]([^`"]*)/g)]
            .map((m) => m[1]);
        expect(logs.length).toBeGreaterThan(2);
        for (const l of logs) {
            if (!l.includes("${model}") && !l.includes("${STT_PRIMARY}")) {
                throw new Error(`log line does not name the model: "${l.trim()}"`);
            }
        }
    });
});

describe("⚖️ what the switch must NOT cost", () => {
    it("the hallucination guards all still run on whatever comes back", () => {
        // The new model is quieter on silence, not incapable of nonsense. All
        // the textual guards are model-independent and stay in the path.
        expect(CODE).toMatch(/isLikelyHallucination\(rawText, effectivePrompt\)/);
        expect(CODE).toMatch(/hasNoSpeech\(json\?\.segments\)/);
    });

    it("🔑 the anonymous quota is counted once per transcription, as before", () => {
        // Untouched by this change, asserted so it stays that way.
        expect(CODE).toMatch(/event_type: "voice_transcribe"/);
        expect(CODE).toMatch(/ANONYMOUS_TRANSCRIBE_DAILY_LIMIT/);
    });

    it("⛔ the 55s abort is still inside Vercel's 60s budget", () => {
        expect(CODE).toMatch(/55_000/);
        // and only ONE timeout value, so the fallback cannot double it past 60s
        expect([...CODE.matchAll(/setTimeout\(\(\) => ctrl\.abort\(\)/g)].length).toBe(1);
    });

    it("⚠️ …but a fallback means TWO sequential 55s attempts in a 60s function", () => {
        // 🔴 KNOWN AND ACCEPTED, recorded so it is not discovered as a
        // surprise. If the primary hangs for its full 55s, the fallback has no
        // time to run and the function is killed at 60s — the person loses the
        // recording exactly as before, no worse. The fallback earns its keep
        // on FAST failures (model unavailable, 4xx, 5xx), which is how a new
        // model actually fails. Making it reliable under a hang would need the
        // primary's timeout cut to ~25s, which would newly abandon slow-but-
        // working transcriptions that succeed today. Not worth it unmeasured.
        expect(maxDurationIs(60)).toBe(true);
    });
});

function maxDurationIs(n: number): boolean {
    return new RegExp(`export const maxDuration = ${n};`).test(CODE);
}
