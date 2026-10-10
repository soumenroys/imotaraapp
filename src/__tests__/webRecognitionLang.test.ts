/**
 * The web half of "spoke Bengali, got English".
 *
 * 🔴 Reported 2026-10-10 on a physical iPhone. The web chat page had the same
 * root cause: `rec.lang = LANG_TO_BCP47[profileLang] ?? "en-US"` resolves
 * "auto" — and an unset preference — to en-US, so the browser's speech
 * recogniser was told to expect English and returned English words for
 * Bengali speech.
 *
 * ⚠️ Unlike Whisper, the Web Speech API has NO auto-detect, so something
 * concrete must be chosen. The conversation is the evidence used, which is
 * what the TTS path here already does for picking a voice.
 */

import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { recognitionLangFor } from "../app/chat/page";

const BN = ["আমি ভালো নেই", "কেমন আছো"];
const GU = ["મને સારું નથી લાગતું"];
const TA = ["எனக்கு நல்லா இல்ல"];
const EN = ["i feel low today", "not great honestly"];

describe("🔴 a stated preference wins — it is a choice", () => {
  it("an explicit language becomes its BCP-47 tag", () => {
    expect(recognitionLangFor("bn", EN)).toBe("bn-IN");
    expect(recognitionLangFor("ta", [])).toBe("ta-IN");
    expect(recognitionLangFor("en", BN)).toBe("en-US");
  });

  it("casing and padding do not defeat it", () => {
    expect(recognitionLangFor(" BN ", EN)).toBe("bn-IN");
  });
});

describe("🔑 no stated preference ⇒ read the conversation", () => {
  it("a Bengali conversation ⇒ Bengali recognition, not English", () => {
    // The reported bug.
    for (const pref of ["auto", "", undefined, null]) {
      expect(recognitionLangFor(pref, BN)).toBe("bn-IN");
    }
  });

  it("the most recent language wins after a switch", () => {
    expect(recognitionLangFor("auto", [...BN, ...GU])).toBe("gu-IN");
    expect(recognitionLangFor("auto", [...GU, ...TA])).toBe("ta-IN");
  });

  it("skips empty turns rather than treating them as English", () => {
    expect(recognitionLangFor("auto", ["", "  ", ...BN])).toBe("bn-IN");
  });
});

describe("⚖️ no working case may regress", () => {
  it("an English conversation still gets en-US — the same guess as before", () => {
    expect(recognitionLangFor("auto", EN)).toBe("en-US");
    expect(recognitionLangFor("auto", [])).toBe("en-US");
    expect(recognitionLangFor(undefined, [])).toBe("en-US");
  });

  it("⛔ romanized Indic does NOT switch the recogniser", () => {
    // Deliberate. The recogniser would then return native script, silently
    // changing the script the person has been typing in — and romanized
    // input is the case the roman-hint detector exists for elsewhere, where
    // the output script is not being changed under anyone.
    expect(recognitionLangFor("auto", ["ami valo nei", "tumi kemon acho"])).toBe("en-US");
  });

  it("an unknown preference code falls through rather than throwing", () => {
    expect(recognitionLangFor("klingon", BN)).toBe("bn-IN");
    expect(recognitionLangFor("klingon", EN)).toBe("en-US");
  });
});

describe("⚠️ every supported language resolves to a real tag", () => {
  it("the 22 languages all map", () => {
    const LANGS = "en hi bn mr ta te gu pa kn ml or ur ar he ru zh ja es fr de pt id".split(" ");
    for (const l of LANGS) {
      const tag = recognitionLangFor(l, []);
      expect(tag, `${l} must map to a BCP-47 tag`).toMatch(/^[a-z]{2}-[A-Z]{2}$/);
      expect(tag, `${l} must not silently become English`).not.toBe(l === "en" ? "" : "en-US");
    }
  });
});

describe("⛔ the wiring — the recogniser must actually be given this", () => {
    const SRC = fs.readFileSync(
        path.join(process.cwd(), "src/app/chat/page.tsx"), "utf8");

    it("rec.lang comes from recognitionLangFor", () => {
        // ⚠️ Added after a mutation that changed the call site to pass `[]`
        // survived: every test above exercises the FUNCTION, and a perfect
        // function fed no conversation reproduces the original bug exactly.
        expect(SRC).toMatch(/rec\.lang = recognitionLangFor\(/);
        expect(SRC).not.toMatch(/rec\.lang = LANG_TO_BCP47\[profileLang\] \?\? "en-US"/);
    });

    it("…and is actually given the conversation, not an empty list", () => {
        const m = /rec\.lang = recognitionLangFor\(([\s\S]{0,200}?)\);/.exec(SRC);
        expect(m, "call site not found").toBeTruthy();
        expect(m![1]).toMatch(/profileLang/);
        expect(m![1]).toMatch(/activeThread\?\.messages/);
        expect(m![1]).toMatch(/\.map\(\(m\) => m\.content\)/);
    });

    it("the recogniser is given a bounded slice, not the whole history", () => {
        // An abandoned language from fifty turns ago is not evidence about
        // what is being spoken now.
        const m = /rec\.lang = recognitionLangFor\(([\s\S]{0,200}?)\);/.exec(SRC);
        expect(m![1]).toMatch(/\.slice\(-\d+\)/);
    });
});
