// src/__tests__/returningLine.test.ts
// #77c (owner, 7 Nov 2026): someone coming back is greeted with how they were
// last time — "Last time you were feeling low. How are you doing today?" — in
// their language, on web AND phone. ⛔ After a crisis: no feeling, no topic.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  returningFeeling, returningLine, returningLangOf, RETURNING_LINES, RETURNING_LANGS, type FeelingDetectors,
} from "@/lib/imotara/returningLine";
import { hasMobileRepo, readMobileFile } from "./helpers/siblingRepo";
import { isStressText } from "@/lib/emotion/keywordMaps";

const fake: FeelingDetectors = {
  isCrisis: (t) => /CRISIS/.test(t),
  isSad: (t) => /sad/.test(t),
  isStressed: (t) => /worried/.test(t),
  isAngry: (t) => /angry/.test(t),
};

describe("which feeling", () => {
  it("⛔ a crisis anywhere in the last 4 messages wins over everything", () => {
    expect(returningFeeling(["CRISIS", "sad", "worried", "angry"], fake)).toBe("crisis");
  });
  it("only the last 4 are read", () => {
    expect(returningFeeling(["CRISIS", "a", "b", "c", "d"], fake)).toBe("plain");
  });
  it("the NEWEST message with a feeling decides", () => {
    expect(returningFeeling(["sad", "worried"], fake)).toBe("stressed");
    expect(returningFeeling(["angry", "hello"], fake)).toBe("angry");
  });
  it("nothing found ⇒ plain (or the platform's heavy hint) — never a guess", () => {
    expect(returningFeeling(["hello"], fake)).toBe("plain");
    expect(returningFeeling(["hello"], fake, true)).toBe("heavy");
    expect(returningFeeling([], fake)).toBe("plain");
  });
});

describe("the words", () => {
  it("22 languages × 6 lines, none empty", () => {
    expect(RETURNING_LANGS).toHaveLength(22);
    for (const l of RETURNING_LANGS) {
      for (const f of ["sad", "stressed", "angry", "heavy", "crisis", "plain"] as const) {
        expect(RETURNING_LINES[l][f].trim().length, `${l}.${f}`).toBeGreaterThan(5);
      }
    }
  });
  it("same 22 languages as the opening chips' check-in card on the phone", () => {
    expect([...RETURNING_LANGS].sort()).toEqual(
      ["en", "hi", "bn", "mr", "ta", "te", "gu", "kn", "ml", "pa", "or", "ur", "ar", "ru", "zh", "ja", "es", "fr", "de", "pt", "id", "he"].sort(),
    );
  });
  it("chosen language, else the language they wrote in, else English ('auto' is not a language)", () => {
    expect(returningLine("sad", "bn")).toBe("গতবার আপনার মন খারাপ ছিল। আজ কেমন আছেন?");
    expect(returningLine("sad", "auto", "hi-IN")).toBe(RETURNING_LINES.hi.sad);
    expect(returningLine("sad", "auto", null)).toBe(RETURNING_LINES.en.sad);
    expect(returningLangOf("xx")).toBeNull();
  });
  it("⛔ the crisis line names no feeling and no topic, in any language", () => {
    expect(RETURNING_LINES.en.crisis).not.toMatch(/last time|low|worry|upset|heavy/i);
    for (const l of RETURNING_LANGS) {
      for (const f of ["sad", "stressed", "angry", "heavy"] as const) {
        expect(RETURNING_LINES[l].crisis).not.toBe(RETURNING_LINES[l][f]);
      }
    }
  });
});

describe("Hindi 'टेंशन' (owner OK 7 Nov)", () => {
  it("both spellings read as stress", () => {
    expect(isStressText("मुझे बहुत टेंशन है")).toBe(true);
    expect(isStressText("बहुत टेन्शन हो रहा है")).toBe(true);
  });
});

describe("web wiring", () => {
  const chat = readFileSync("src/app/chat/page.tsx", "utf8");
  it("the welcome-back message uses the feeling line first", () => {
    expect(chat).toMatch(/const feeling = returningFeeling\(userTexts, RETURNING_DETECTORS\);/);
    expect(chat).toMatch(/if \(feeling !== "plain"\) \{[\s\S]{0,200}reentryText = returningLine\(feeling, lang\);/);
  });
  it("⛔ crisis detection is the same union as the invite card (never narrower)", () => {
    expect(chat).toMatch(/isCrisis: \(t\) => isCrisisTier2\(t\) \|\| CRISIS_TIER1_RE\.test\(t\) \|\| CRISIS_INDIC_TIER1_RE\.test\(t\) \|\| CRISIS_ROMAN_INDIC_TIER1_RE\.test\(t\)/);
  });
  it("'auto' no longer means English", () => {
    expect(chat).toMatch(/const lang = returningLangOf\(profile\?\.user\?\.preferredLang\) \?\? returningLangOf\(scriptLang\) \?\? "en";/);
  });
});

(hasMobileRepo() ? describe : describe.skip)("⚠️ the phone has the SAME file", () => {
  it("imotara-mobile src/lib/welcome/returningLine.ts is byte-identical", () => {
    const mine = readFileSync("src/lib/imotara/returningLine.ts", "utf8");
    expect(readMobileFile("src/lib/welcome/returningLine.ts")).toBe(mine);
  });
});
