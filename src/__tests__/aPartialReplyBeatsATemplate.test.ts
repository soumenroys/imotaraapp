/**
 * A real half-reply is better than a canned whole one.
 *
 * 🔴 U9 of the 2026-10-09 audit, VERIFIED. Web's streaming catch was EMPTY:
 *
 *     } catch {
 *         // Streaming path unavailable — fall through to template path below
 *     }
 *
 * Two failures in four lines. It logged NOTHING in any environment, so a
 * stalled stream silently became a template and no record existed. And
 * `fullText` was scoped inside the try, so a stall after most of a good reply
 * THREW THAT REPLY AWAY — after onChunk had already rendered it on screen.
 *
 * ⚠️ The person had READ those words. Replacing them with a canned line is
 * worse twice over: lower quality, and it visibly rewrites what they were in
 * the middle of reading.
 *
 * 🔑 LANGUAGE NOTE. Trimming to the last complete sentence is useless for most
 * of this product's users unless the terminator list includes `।` (Devanagari
 * danda) and the full-width CJK stops. Without them Hindi, Bengali, Marathi,
 * Chinese and Japanese would never find a boundary, and a feature written to
 * protect reply quality would quietly do nothing for the languages that need
 * it most.
 */

import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const raw = (f: string) => fs.readFileSync(path.join(process.cwd(), f), "utf8");
const code = (f: string) =>
  raw(f).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const R = "src/lib/imotara/respondRemote.ts";

/** Mirror of trimToLastSentence, so the BEHAVIOUR is asserted. */
function trim(text: string): string {
  const t = text.trim();
  if (!t) return "";
  let cut = -1;
  for (const ch of [".", "!", "?", "।", "。", "！", "？"]) cut = Math.max(cut, t.lastIndexOf(ch));
  if (cut < 0) return "";
  return t.slice(0, cut + 1).trim();
}

describe("🔴 a stalled stream no longer discards what it already had", () => {
  it("fullText is visible to the catch", () => {
    const s = code(R);
    // Scoped inside the try, the catch could not see it — which is exactly why
    // the reply was lost rather than kept.
    expect(s).toMatch(/let fullText = "";\s*try \{/);
    expect(s).not.toMatch(/let buffer = "";\s*let fullText = "";/);
  });

  it("⛔ the STREAMING catch is no longer empty", () => {
    // ⚠️ Not a blanket "no empty catch anywhere" assertion — code() strips
    // comments, so every legitimate `catch { /* ignore */ }` in the file looks
    // empty to it. Assert about THIS catch.
    const s = code(R);
    expect(s).toMatch(/streaming failed after \$\{fullText\.length\} chars/);
    const i = s.indexOf("streaming failed after");
    expect(s.slice(Math.max(0, i - 200), i)).toMatch(/\} catch \(err\) \{/);
  });

  it("🔑 a substantial partial reply is RETURNED, not thrown away", () => {
    const s = code(R);
    expect(s).toMatch(/const salvaged = trimToLastSentence\(fullText\);/);
    expect(s).toMatch(/if \(salvaged\.length >= MIN_SALVAGEABLE_REPLY_CHARS && !isBadPlaceholderText\(salvaged\)\)/);
    expect(s).toMatch(/message: salvaged,/);
  });

  it("⚠️ …and a known-bad placeholder is still rejected", () => {
    // Salvaging must not become a way to resurrect the strings the JSON path
    // spent effort learning to refuse.
    expect(code(R)).toMatch(/!isBadPlaceholderText\(salvaged\)/);
  });
});

describe("🔑 the sentence trim works for the languages this product serves", () => {
  it.each([
    ["English", "I hear you. That sounds really heavy and I", "I hear you."],
    ["Hindi (danda)", "मैं यहीं हूँ। तुम बताओ क्या", "मैं यहीं हूँ।"],
    ["Bengali (danda)", "আমি আছি তোমার সাথে। তুমি বলো", "আমি আছি তোমার সাথে।"],
    ["Chinese", "我在这里。你可以慢慢", "我在这里。"],
    ["Japanese", "ここにいます。ゆっくり", "ここにいます。"],
    ["question", "Are you okay? I was just", "Are you okay?"],
  ])("%s", (_label, input, want) => {
    expect(trim(input)).toBe(want);
  });

  it("⛔ an unfinished clause with no terminator salvages NOTHING", () => {
    // Returning "I was just about to" would be worse than a template.
    expect(trim("I was just about to")).toBe("");
  });

  it("🔑 the SOURCE carries the Indic and CJK terminators, not just this mirror", () => {
    // Drop `।` and every Hindi/Bengali/Marathi partial silently salvages
    // nothing — the feature would look present and do nothing for them.
    const s = raw(R);
    expect(s).toMatch(/\\u0964/);   // danda
    expect(s).toMatch(/\\u3002/);   // 。
    expect(s).toMatch(/\\uFF01/);   // ！
    expect(s).toMatch(/\\uFF1F/);   // ？
  });

  it("🔑 the floor keeps real NATIVE-SCRIPT replies, which are the shortest", () => {
    // ⚠️ This caught a real bug in the first version of the fix: a floor of 25
    // would have discarded EVERY native-script reply below, so a change made
    // to protect reply quality would have silently done nothing for Hindi,
    // Bengali, Tamil, Chinese and Japanese.
    const s = code(R);
    expect(s).toMatch(/const MIN_SALVAGEABLE_REPLY_CHARS = 8;/);
    for (const keep of ["আমি আছি।", "I hear you.", "मैं यहीं हूँ।", "Naan irukken.", "Ami achi tomar sathe."]) {
      expect(trim(keep + " and then").length, keep).toBeGreaterThanOrEqual(8);
    }
    // …while a bare fragment is still not worth showing
    for (const drop of ["Hi.", "Ok."]) {
      expect(trim(drop + " x").length, drop).toBeLessThan(8);
    }
  });
});
