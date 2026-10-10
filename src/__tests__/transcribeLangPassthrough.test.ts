/**
 * What this route tells Whisper the audio is in.
 *
 * 🔴 Reported 2026-10-10, physical iPhone: spoke Bengali, got English text.
 * The client was sending `lang=en` (it derived the value with `concreteLang`,
 * which maps "auto" and unset to "en"), and this route forwards any code it
 * recognises straight to Whisper. Whisper obeyed and rendered Bengali speech
 * as English words.
 *
 * The client fix is to send "auto" when the person has stated no preference.
 * THIS file pins the half of the contract that lives here: a code Whisper
 * knows is forwarded, and anything else is omitted so Whisper auto-detects.
 * The mobile side must not have to guess at that, so it is asserted next to
 * the code rather than mirrored in the app.
 */

import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import {
    whisperLanguageFor, WHISPER_LANGS, STT_PRIMARY, STT_FALLBACK,
} from "../app/api/voice/transcribe/route";

const SRC = fs.readFileSync(
    path.join(process.cwd(), "src/app/api/voice/transcribe/route.ts"), "utf8");

/**
 * ⚠️ THE REAL DECISION, imported — not a re-implementation.
 *
 * The first version of this file re-implemented the route's logic here
 * (`lang.split("-")[0]`, then a set lookup). A mutation that removed the
 * BCP-47 split FROM THE ROUTE then survived, because the copy in this file
 * still did it. That is the mirror trap: a test that re-implements what it is
 * checking can only ever agree with itself.
 */
const appendsLanguage = whisperLanguageFor;
const whisperLangs = () => WHISPER_LANGS;

describe("🔑 'auto' must reach Whisper as NO language", () => {
    it("'auto' is not forwarded — Whisper auto-detects", () => {
        expect(appendsLanguage("auto")).toBeNull();
    });

    it("…and so is a missing or empty value", () => {
        expect(appendsLanguage(undefined)).toBeNull();
        expect(appendsLanguage(null)).toBeNull();
        expect(appendsLanguage("")).toBeNull();
    });

    it("⛔ 'auto' is not in the route's language set", () => {
        // Read from the route, so this cannot drift from it.
        expect(whisperLangs().has("auto")).toBe(false);
    });
});

describe("⛔ a real choice is still forwarded — the money case", () => {
    it("🔑 Bengali IS forwarded now — the new model accepts it", () => {
        // ⚠️ THIS ASSERTION HAS BEEN BOTH WAYS ROUND, and both times it was
        // right about a DIFFERENT model. Keep the history, because the lesson
        // is the whole value of this file:
        //
        //   written first as "forwarded", from a code comment claiming
        //     "Whisper supports all five"           — wrong, whisper-1 400s
        //   corrected to "not forwarded"            — right, for whisper-1
        //   now "forwarded" again                   — right, for gpt-transcribe
        //
        // Measured 2026-10-10 against both models:
        //   gpt-transcribe  language=bn → ✅ "আমার আজ খুব ক্লান্ত লাগছে"
        //   whisper-1       language=bn → ❌ Language 'bn' is not supported.
        //
        // 🔑 So the answer depends on the model, and the function takes one.
        // Defaulting it to the primary is what the route does.
        expect(appendsLanguage("bn")).toBe("bn");
        expect(whisperLanguageFor("bn", STT_PRIMARY)).toBe("bn");
        expect(whisperLanguageFor("bn", STT_FALLBACK)).toBeNull();
    });

    it("the Indian languages the API DOES accept are forwarded", () => {
        for (const l of ["hi", "ta", "mr", "kn", "ur"]) {
            expect(appendsLanguage(l), `${l} must reach Whisper`).toBe(l);
        }
    });

    it("…and the ones with no usable hint are omitted, so auto-detect runs", () => {
        // ⚠️ REWRITTEN TWICE on inference before being measured. The list is
        // now exactly the codes BOTH models refuse: Punjabi and Odia.
        //   gpt-transcribe  Language code 'pa' is not recognized.
        //   whisper-1       Language 'pa' is not supported.
        // Those two rely on a script prompt instead; see
        // whisperRejectsSomeIndicLanguages.test.ts.
        for (const l of ["pa", "or"]) {
            expect(appendsLanguage(l), `${l} must NOT be sent`).toBeNull();
            expect(whisperLanguageFor(l, STT_FALLBACK), `${l} on the fallback`).toBeNull();
        }
    });

    it("🔴 the four the FALLBACK cannot take are omitted only on the fallback", () => {
        // The asymmetry the model switch introduced, and the reason the route
        // rebuilds its request body instead of mutating it: these four lose
        // their hint when we fall back, and need a script prompt in its place.
        for (const l of ["bn", "te", "gu", "ml"]) {
            expect(whisperLanguageFor(l, STT_PRIMARY), `${l} on the primary`).toBe(l);
            expect(whisperLanguageFor(l, STT_FALLBACK), `${l} on the fallback`).toBeNull();
        }
    });

    it("the foreign languages are forwarded too", () => {
        for (const l of ["ar", "he", "ru", "zh", "ja", "es", "fr", "de", "pt", "id", "en"]) {
            expect(appendsLanguage(l), `${l} must reach Whisper`).toBe(l);
        }
    });

    it("Odia is NOT forwarded — Whisper has no 'or'", () => {
        // Sending it would 400. Auto-detect is the only option for Odia, and
        // this is the documented reason the omit-branch exists at all.
        expect(appendsLanguage("or")).toBeNull();
    });

    it("a BCP-47 tag is reduced to its ISO-639-1 base", () => {
        // ⚠️ bn-IN no longer demonstrates this, because bn is not forwarded
        // at all now. hi-IN makes the same point with a code the API takes.
        expect(appendsLanguage("hi-IN")).toBe("hi");
        expect(appendsLanguage("en-US")).toBe("en");
        expect(appendsLanguage("ta-IN")).toBe("ta");
    });
});

describe("⚠️ the premise, pinned", () => {
    it("POST actually uses this decision, rather than its own copy", () => {
        // The behaviour above is tested through the imported function; this is
        // the one thing that cannot be: that the request path calls it.
        // ⚠️ RE-POINTED 2026-10-10, not loosened. The decision is now made
        // per model inside buildForm, and can be suppressed entirely for the
        // retry after the API refuses a code.
        expect(SRC).toMatch(/const code = withLanguageHint \? whisperLanguageFor\(lang, model\) : null;/);
        expect(SRC).toMatch(/if \(code\) form\.append\("language", code\);/);
    });

    it("⛔ the decision never defaults to English", () => {
        // The failure mode this whole report came from. Scoped to the
        // function, so an unrelated "en" elsewhere cannot mask it.
        const i = SRC.indexOf("export function whisperLanguageFor(");
        expect(i).toBeGreaterThan(-1);
        const fn = SRC.slice(i, SRC.indexOf("\n}", i));
        expect(fn).not.toMatch(/"en"/);
        expect(fn).toMatch(/return null;/);
    });
});
