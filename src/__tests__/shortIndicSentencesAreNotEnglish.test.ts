/**
 * A short, complete Indic sentence must be detected as that language.
 *
 * 🔴 WHY, found 2026-10-09 while deriving a device-check script from the code
 * rather than from memory. Web and mobile ran DIFFERENT algorithms:
 *
 *   web    — compare an English signal against the winning hint, 1 hit is enough
 *   mobile — a flat `best[1] >= 2` hit threshold
 *
 * Measured on 35 real sentences: they disagreed on 13, and MOBILE was wrong on
 * 11 — `kem cho`, `ami valo nei`, `mera dil bhari hai`, `enakku kashtama
 * irukku`, `njan sukhamalla` all came back "en".
 *
 * ⚠️ Those are the shortest and most common messages this product receives: a
 * bare statement of distress. Mobile sent lang:"en"; the server reads body.lang
 * verbatim and on "en" injects "reply in English only — do not mirror their
 * non-English script". So the user was answered in a language they had not
 * written in, by design, on the most vulnerable message they could send.
 *
 * ⛔ THE THRESHOLD WAS THE BUG, and `englishIsNotGujarati.test.ts` already said
 * so: it cannot tell a complete short sentence ("kem cho" scores 1) from one
 * coincidental English match. It rejected both.
 *
 * This file pins the WEB half. The mobile half is
 * `imotara-mobile/src/__tests__/languageDetection.test.ts`.
 */

import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { detectLangFromRomanHints } from "@/lib/imotara/respondRemote";

const code = (f: string) =>
  fs.readFileSync(path.join(process.cwd(), f), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

describe("🔴 one hit is enough when the sentence is genuinely that language", () => {
  it.each([
    ["kem cho", "gu"],
    ["majama", "gu"],
    ["ami valo nei", "bn"],
    ["mera dil bhari hai", "hi"],
    ["enakku kashtama irukku", "ta"],
    ["njan sukhamalla", "ml"],
    ["enikku valare budhimuttu", "ml"],
    ["nenu bagundanu ledu", "te"],
  ])("%s → %s", (sentence, want) => {
    expect(detectLangFromRomanHints(sentence)).toBe(want);
  });
});

describe("⛔ a 1–2 letter token alone is NOT evidence of a language", () => {
  it.each(["Ho ho ho", "Na, it is fine"])("%s stays English", (s) => {
    // Measured on mobile, whose rows carry these short tokens: "Ho ho ho"
    // matched hi=[Ho,ho,ho] and nothing else, and was answered in Hindi.
    expect(detectLangFromRomanHints(s)).toBe("en");
  });

  it("✅ …but the short pronouns still COUNT, so these keep working", () => {
    // `mi`/`mu` are real first-person pronouns. Deleting them would be the
    // wrong fix; they simply cannot win alone. Each of these has a substantive
    // match beside the pronoun: or=[mu,bhala], mr=[mi,theek nahi,aahe].
    expect(detectLangFromRomanHints("mu bhala nahin")).toBe("or");
    expect(detectLangFromRomanHints("mi theek nahi aahe")).toBe("mr");
  });

  it("the gate is in the source, and it FILTERS the winner", () => {
    // Tracking `substantive` without filtering on it would look like a fix and
    // do nothing.
    const s = code("src/lib/imotara/respondRemote.ts");
    expect(s).toMatch(/if \(m\.some\(\(hit\) => hit\.trim\(\)\.length >= 3\)\) substantive\[lang\] = true;/);
    expect(s).toMatch(/\.filter\(\(\[lang\]\) => substantive\[lang\]\)/);
  });
});

describe("🔑 Marathi and Kannada are reachable from romanized input", () => {
  it("Marathi is no longer swallowed by Hindi's `nahi`", () => {
    // Was "hi": web's mr row had only "thik aahe", so this matched mr=[mi] (a
    // 2-letter pronoun) against hi=[nahi]. Adding bare `aahe` fixes it.
    expect(detectLangFromRomanHints("mi theek nahi aahe")).toBe("mr");
    expect(detectLangFromRomanHints("mala khup tras hoto aahe")).toBe("mr");
  });

  it("Kannada 'I am not well' is detected", () => {
    // Was "en": the row had `chennagide` (well) but not `chennagilla` (not well)
    // — so it knew the happy word and not the sad one, in a product for distress.
    expect(detectLangFromRomanHints("nanu chennagilla")).toBe("kn");
    expect(detectLangFromRomanHints("enage tumba kashta agide")).toBe("kn");
  });
});

describe("⚖️ and plain English did not pay for any of it", () => {
  it.each([
    "I have no one to talk to",
    "Everything is fine, I have work tomorrow",
    "Do you have a minute?",
    "Sometimes I wonder if anyone would notice",
    "I lost my job last week and I am struggling",
    "Nothing seems to matter",
    "Can we talk about something else",
  ])("%s", (s) => {
    expect(detectLangFromRomanHints(s)).toBe("en");
  });

  it("🔑 code-mixing is still not collateral damage", () => {
    // English nouns inside Indic grammar — the normal register for these
    // speakers, and the regression my own 5970e33 fix originally caused.
    expect(detectLangFromRomanHints("mane work ma problem che")).toBe("gu");
    expect(detectLangFromRomanHints("enakku really kashtama irukku today")).toBe("ta");
    expect(detectLangFromRomanHints("I know this is hard lekin mera dil bhari hai")).not.toBe("en");
  });

  it("⚠️ the known remaining limit, recorded honestly", () => {
    // `main` is genuinely "I" in Punjabi, so deleting it would break real
    // Punjabi. ⚠️ MOBILE GETS THIS RIGHT ("en") because its pa row omits
    // `main` — the one case where the two still disagree.
    expect(detectLangFromRomanHints("My main concern is money")).toBe("pa");
  });
});
