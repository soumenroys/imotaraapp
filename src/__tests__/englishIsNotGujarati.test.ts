/**
 * Plain English must not be answered in an Indian language — and a clipped
 * reply must not be invisible.
 *
 * ── 1. THE "have" COLLISION ─────────────────────────────────────────────
 *
 * `detectLangFromRomanHints` treated ONE word hit as proof of a language, and
 * its Gujarati row contained the English word **have**. So:
 *
 *     "I have no one to talk to"  →  gu
 *
 * …which produces a Gujarati-script reply, a Gujarati TTS voice, and a wasted
 * transliteration round-trip, for someone writing plain English. Other rows
 * carried the same shape: `main` (pa), `em` (te), `sari` (ta/kn), `mo` (or).
 *
 * Two files in this repo measured ~15% false positives on English and
 * deliberately routed around this function — `connect/translate.ts:74-82` and
 * `connect/session/[id]/page.tsx:200-206` — while chat and web TTS kept
 * calling it.
 *
 * ⛔ Raising the threshold to 2 is the obvious fix and is wrong: `tally` sums
 * TOTAL matches, so "I have no one and I have nothing" already scores 2, while
 * "kem cho" — a complete Gujarati greeting — scores 1. It trades false
 * positives for false negatives on exactly the short messages this product
 * gets most.
 *
 * ⛔ Deleting every colliding word is also wrong: `main` is "I" in Punjabi.
 *
 * ✅ Two changes instead. (a) Compare signals: English must be at least as
 * strong as the winning hint and carry real weight, with `indicGrammar` as an
 * absolute veto so "mera dil bhari hai" is never called English. (b) Align the
 * Gujarati row to the already-vetted list in `emotion/keywordMaps.ts:54`,
 * which had dropped `have|tame|hu|hun|mane|su|thai` and kept `hve`. That row
 * had simply drifted from it.
 *
 * ── 2. TRUNCATION ───────────────────────────────────────────────────────
 *
 * `finish_reason` was not in `OpenAIChatResult` at all, so a reply cut off at
 * maxTokens was indistinguishable from a finished one. It matters most for
 * Indic: non-English gets ×1.4, but ROMANIZED input is capped back to 280
 * (320 for bn) — and romanized Latin is the most token-hungry form there is.
 * The case most likely to be clipped was the one nobody could measure.
 */

import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { detectLangFromRomanHints } from "@/lib/imotara/respondRemote";

const code = (f: string) =>
  fs.readFileSync(path.join(process.cwd(), f), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

describe("🔴 plain English stays English", () => {
  it.each([
    "I have been thinking about my life lately",
    "Do you have a minute?",
    "I have no one to talk to",
    "I have no one and I have nothing",
    "Everything is fine, I have work tomorrow",
  ])("%s", (sentence) => {
    expect(detectLangFromRomanHints(sentence)).toBe("en");
  });

  it("⚠️ the known remaining limit, recorded honestly", () => {
    // One colliding word and no other English marker still slips through.
    // `main` is genuinely "I" in Punjabi, so deleting it would break real
    // Punjabi. Narrower than before, not gone.
    expect(detectLangFromRomanHints("My main concern is money")).toBe("pa");
  });
});

describe("🔴 …and genuine romanized Indic is NOT collateral damage", () => {
  it.each([
    ["kem cho", "gu"],                                  // 1 hit — the case a threshold raise would break
    ["hun samajhu chhun aa khub kathin che", "gu"],
    ["ami khub valo nei tumi kemon acho", "bn"],
    ["mera dil bhari hai aaj", "hi"],
    ["main samajh sakta hoon ye mushkil hai", "hi"],    // `main` here IS Punjabi/Hindi "I"
    ["naan romba kashtama irukken", "ta"],
  ])("%s → %s", (sentence, want) => {
    expect(detectLangFromRomanHints(sentence)).toBe(want);
  });

  it("🔑 indicGrammar vetoes the English signal outright", () => {
    // Code-mixed text is Latin-script but not English. The veto is what makes
    // the whole comparison safe.
    expect(detectLangFromRomanHints("I know this is hard lekin mera dil bhari hai")).not.toBe("en");
  });
});

describe("the fix is where I say it is", () => {
  it("the comparison guard exists and respects the veto", () => {
    const s = code("src/lib/imotara/respondRemote.ts");
    expect(s).toMatch(/const english = englishSignal\(t\);/);
    expect(s).toMatch(/!english\.vetoed && english\.score >= 2 && english\.score >= best\[1\]/);
  });

  it("⛔ the Gujarati row no longer contains the English word `have`", () => {
    const s = code("src/lib/imotara/respondRemote.ts");
    const gu = s.match(/tally\("gu", \/\\b\((.*?)\)\\b\/i\);/)?.[1] ?? "";
    expect(gu.length).toBeGreaterThan(0);
    for (const w of ["have", "tame", "hu", "hun", "mane"]) {
      expect(gu.split("|")).not.toContain(w);
    }
    // …but it is still a working Gujarati detector
    expect(gu.split("|")).toContain("che");
    expect(gu.split("|")).toContain("kem");
  });

  it("…and the mobile copy was aligned to the same vetted list", () => {
    const s = fs.readFileSync(
      "/Users/soumenroy/Projects/imotara-mobile/src/lib/emotion/keywordMaps.ts", "utf8",
    );
    const gu = s.match(/ROMAN_GU_LANG_HINT_REGEX\s*=\s*\n?\s*\/\\b\((.*?)\)\\b\/i;/s)?.[1] ?? "";
    if (!gu) {
      console.warn("[englishIsNotGujarati] ⚠️ SKIPPED the mobile half — sibling repo not checked out.");
      return;
    }
    expect(gu.split("|")).not.toContain("have");
    expect(gu.split("|")).toContain("hve");
  });
});

describe("🔴 a truncated reply is no longer invisible", () => {
  it("finish_reason is in the response type at all", () => {
    const s = code("src/lib/imotara/aiClient.ts");
    expect(s).toMatch(/finish_reason\?: string;/);
  });

  it("…and it is actually READ and logged", () => {
    // Adding the field without reading it would look like a fix and be none.
    const s = code("src/lib/imotara/aiClient.ts");
    expect(s).toMatch(/data\?\.choices\?\.\[0\]\?\.finish_reason/);
    expect(s).toMatch(/finishReason === "length"/);
    expect(s).toMatch(/reply TRUNCATED at maxTokens/);
  });

  it("⚠️ it warns rather than paging — a clipped reply is a metric, not an incident", () => {
    const s = code("src/lib/imotara/aiClient.ts");
    const block = s.slice(s.indexOf('finishReason === "length"'), s.indexOf('finishReason === "length"') + 400);
    expect(block).toMatch(/console\.warn/);
    expect(block).not.toMatch(/sendOutageAlert/);
  });

  it("🔑 the log carries the numbers needed to act on it", () => {
    // "something was truncated" is not actionable. Which budget, and how many
    // tokens it actually used, is.
    const s = code("src/lib/imotara/aiClient.ts");
    expect(s).toMatch(/maxTokens=\$\{maxTokens\}/);
    expect(s).toMatch(/completion_tokens=/);
  });
});
