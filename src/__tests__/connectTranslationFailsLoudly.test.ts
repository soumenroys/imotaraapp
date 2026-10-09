/**
 * A paid session must not lose its translation in silence.
 *
 * 🔴 U6 and U7 of the 2026-10-09 audit, both VERIFIED 2026-10-10 against the
 * cited lines. Both were exactly as reported.
 *
 * ── U7: a 4s race against a 40s chain ───────────────────────────────────
 * connect/sessions/[id]/messages posts a message and races translation
 * against a 4s timer. On a lost race `translatedContent` stayed null, the
 * message was inserted untranslated, and NOTHING WAS LOGGED — on a paid
 * per-minute session where translation is the thing being paid for.
 *
 * ⚠️ And the race is not close: translateText chains FOUR providers at 10s
 * each, so ~40s is a legitimate run. Any slow first provider loses, every
 * time, and the chain keeps burning work whose result is discarded.
 *
 * ⛔ NOT "fixed" by raising the 4s. Blocking a live session on a slow
 * translator is worse than delivering the message. This makes the failure
 * VISIBLE so its frequency stops being a guess.
 *
 * ── U6: a guessed source returned as a success ──────────────────────────
 * connect/translate returns the UNTRANSLATED original with ok:true whenever
 * the source language equals the target. Correct when the caller TOLD us the
 * source; a silent failure when we guessed it — and mobile ALWAYS makes us
 * guess, because both ConnectScreen call sites post only {text, targetLang}.
 *
 * ✅ The specific trigger is already gone: detectScript falls through to
 * detectLangFromRomanHints, whose Gujarati row held the English word `have`.
 * Fixed 2026-10-09. The structural problem — a guess is a guess — remains.
 */

import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const raw = (f: string) => fs.readFileSync(path.join(process.cwd(), f), "utf8");
const MESSAGES = "src/app/api/connect/sessions/[id]/messages/route.ts";
const TRANSLATE = "src/app/api/connect/translate/route.ts";
const LIB = "src/lib/connect/translate.ts";

describe("🔴 U7 — a lost translation race is no longer silent", () => {
  const s = raw(MESSAGES);

  it("a null result is logged, with the numbers needed to act on it", () => {
    expect(s).toMatch(/if \(translatedContent === null\) \{/);
    expect(s).toMatch(/translation MISSED the 4s window/);
    expect(s).toMatch(/waited=\$\{Date\.now\(\) - tTranslate\}ms/);
    expect(s).toMatch(/\$\{sourceLang\}->\$\{targetLang\}/);
  });

  it("⛔ the 4s window itself is UNCHANGED — delivery still wins", () => {
    // Raising it would block a live session behind a slow translator.
    expect(s).toMatch(/setTimeout\(\(\) => res\(null\), 4000\)/);
  });

  it("⚠️ the premise holds: translateText really can take ~40s", () => {
    // Four providers, 10s each. If this stops being true the 4s number
    // deserves revisiting — but it is the CHAIN that makes the race unfair.
    const lib = raw(LIB);
    const tenSecondTimers = [...lib.matchAll(/setTimeout\(\(\) => ctrl\.abort\(\), 10_000\)/g)];
    expect(tenSecondTimers.length).toBeGreaterThanOrEqual(4);
  });
});

describe("🔴 U6 — a GUESSED source is reported as a guess", () => {
  const s = raw(TRANSLATE);

  it("the response says what the source was and whether it was guessed", () => {
    expect(s).toMatch(/const guessed = rawSource === "auto";/);
    expect(s).toMatch(/sourceWasGuessed: guessed,/);
    expect(s).toMatch(/unchanged: true,/);
  });

  it("…and a guess that lands on the target language is logged", () => {
    expect(s).toMatch(/if \(guessed\) \{/);
    expect(s).toMatch(/source GUESSED as .* and it equals targetLang/);
  });

  it("⛔ an EXPLICIT source returning the original is still a quiet success", () => {
    // The caller said so; there is genuinely nothing to translate. Logging
    // that would be noise, and noise is how real warnings get ignored.
    const i = s.indexOf("if (sourceLang === targetLang) {");
    const block = s.slice(i, i + 1800);
    expect(block).toMatch(/if \(guessed\) \{[\s\S]{0,400}?console\.warn/);
  });

  it("🔑 the detector it guesses with is the one that was fixed tonight", () => {
    // detectScript's Latin fallback IS detectLangFromRomanHints — the `have`
    // collision lived there. If this link breaks, U6's trigger can return.
    expect(raw(LIB)).toMatch(/return detectLangFromRomanHints\(text\);/);
  });
});
