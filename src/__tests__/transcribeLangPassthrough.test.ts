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
import { whisperLanguageFor, WHISPER_LANGS } from "../app/api/voice/transcribe/route";

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
    it("Bengali is forwarded as bn", () => {
        // Explicit codes exist precisely because bare auto-detection
        // "mislabels short Indic utterances as Hindi/Arabic" (route comment).
        expect(appendsLanguage("bn")).toBe("bn");
    });

    it("every Indian language Whisper supports is forwarded", () => {
        for (const l of ["hi", "bn", "ta", "te", "mr", "gu", "kn", "ml", "pa", "ur"]) {
            expect(appendsLanguage(l), `${l} must reach Whisper`).toBe(l);
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
        expect(appendsLanguage("bn-IN")).toBe("bn");
        expect(appendsLanguage("en-US")).toBe("en");
    });
});

describe("⚠️ the premise, pinned", () => {
    it("POST actually uses this decision, rather than its own copy", () => {
        // The behaviour above is tested through the imported function; this is
        // the one thing that cannot be: that the request path calls it.
        expect(SRC).toMatch(/const whisperLang = whisperLanguageFor\(lang\);/);
        expect(SRC).toMatch(/if \(whisperLang\) whisperForm\.append\("language", whisperLang\);/);
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
