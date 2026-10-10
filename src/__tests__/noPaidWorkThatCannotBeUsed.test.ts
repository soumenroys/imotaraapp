/**
 * U19, U20 and U22 — three findings, all verified before being touched.
 *
 * ── U19: a Gemini call whose answer was discarded unread ────────────────
 * ⚠️ THE AUDIT WAS HALF WRONG, and checking mattered. It called this an
 * "unbudgeted 10s Gemini fallback"; the call carries `abortMs: 4000`. What IS
 * real is the discard: the quote keeps the result only when
 * `meta.from === "openai"`, so when OpenAI failed, Gemini still ran — with a
 * SIX-SECOND floor from remainingBudgetMs() — and its answer was thrown away
 * unread. Paid work that could never be used, plus up to six seconds added to
 * a response nobody was waiting on the quote for.
 *
 * ── U20: three silent fallbacks in transliterateIfNeeded ────────────────
 * All three correctly fall back to the original romanized text. All three did
 * it in silence, so a transliteration endpoint that was simply BROKEN looked
 * exactly like one that had nothing to add. ⛔ The behaviour is unchanged —
 * failing open is right. Only the silence is gone.
 *
 * ── U22: a header describing an architecture that no longer exists ──────
 * mobileTTS.ts claimed native-first with a PRE-GENERATED Azure MP3 on a CDN,
 * and stated flatly that "Azure is never called for English". None of it true.
 * A comment asserting behaviour the code lacks is worse than no comment,
 * because people act on it.
 */

import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { MOBILE_REPO } from "./helpers/siblingRepo";

const raw = (f: string) => fs.readFileSync(path.join(process.cwd(), f), "utf8");
const code = (f: string) =>
  raw(f).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const AI = "src/lib/imotara/aiClient.ts";
const RESPOND = "src/app/api/respond/route.ts";
// ⚠️ Relative, never an absolute home directory — see helpers/siblingRepo.
const MTTS = path.join(MOBILE_REPO, "src/lib/tts/mobileTTS.ts");

describe("🔴 U19 — no second engine for a caller that discards its answer", () => {
  it("the option exists and is honoured at EVERY fallback site", () => {
    const s = code(AI);
    expect(s).toMatch(/noFallback\?: boolean;/);
    // ⚠️ FOUR, not two. My first version asserted 2 — the JSON path's pair —
    // and the pre-existing serverFitsTheClientBudget test caught it: the two
    // STREAMING sites still ignored noFallback, so a streaming caller asking
    // for no fallback was silently given one. The older guarantee knew the
    // number was four and mine did not.
    expect([...s.matchAll(/if \(!plan\.fallbackEnabled \|\| options\.noFallback\)/g)].length).toBe(4);
    // … and the hedge, which is a second engine too
    expect(s).toMatch(/if \(plan\.hedgeAfterMs === null \|\| options\.noFallback\)/);
  });

  it("🔑 the quote call uses it, and still discards non-OpenAI output", () => {
    const s = raw(RESPOND);
    expect(s).toMatch(/noFallback: true,/);
    expect(s).toMatch(/r\.meta\.from === "openai" && r\.text \? r\.text\.trim\(\) : null/);
  });

  it("⚠️ the audit's OTHER claim was false — the call IS budgeted", () => {
    // Recorded so nobody 'fixes' an unbudgeted call that does not exist.
    expect(raw(RESPOND)).toMatch(/abortMs: 4000,/);
  });

  it("⛔ the REPLY path must keep its fallback — it is not opted out", () => {
    // On the reply path the fallback is what stands between the person and a
    // template. If noFallback ever appears in chat-reply, that is a bug.
    expect(raw("src/app/api/chat-reply/route.ts")).not.toMatch(/noFallback/);
  });

  it("…and the fallback still runs for everyone who did not opt out", () => {
    const s = code(AI);
    expect([...s.matchAll(/callGeminiAI\(prompt, \{ \.\.\.options, abortMs: remainingBudgetMs/g)].length)
      .toBeGreaterThanOrEqual(2);
  });
});

describe("🔴 U20 — a broken transliterator no longer looks like a quiet one", () => {
  it("all three exits say something", () => {
    if (!fs.existsSync(MTTS)) { console.warn("[noPaidWork] ⚠️ SKIPPED — sibling repo absent."); return; }
    const s = fs.readFileSync(MTTS, "utf8");
    expect(s).toMatch(/transliterate HTTP \$\{res\.status\} for lang=\$\{lang\}/);
    expect(s).toMatch(/transliterate returned nothing usable for lang=\$\{lang\}/);
    expect(s).toMatch(/transliterate failed for lang=\$\{lang\}/);
  });

  it("⛔ …and every one still returns the original text", () => {
    // Failing open is correct and is NOT what changed. If a log ever replaced
    // a `return text`, romanized replies would be spoken as nothing at all.
    if (!fs.existsSync(MTTS)) return;
    const s = fs.readFileSync(MTTS, "utf8");
    const fn = s.slice(s.indexOf("transliterateIfNeeded"), s.indexOf("export function detectMessageLang"));
    expect([...fn.matchAll(/return text;/g)].length).toBeGreaterThanOrEqual(4);
  });
});

describe("🔴 U22 — the header now describes the code that exists", () => {
  it("⛔ the false claims are gone", () => {
    if (!fs.existsSync(MTTS)) return;
    const s = fs.readFileSync(MTTS, "utf8");
    expect(s).not.toMatch(/Azure is never called for English/);
    expect(s).not.toMatch(/pre-generated Azure MP3 from Imotara's CDN/);
  });

  it("…and what replaced them is checkable against the code", () => {
    if (!fs.existsSync(MTTS)) return;
    const s = fs.readFileSync(MTTS, "utf8");
    // the header now says the gate decides; the code must actually do that
    expect(s).toMatch(/useNeuralVoice/);
    expect(s).toMatch(/if \(!useNeuralVoice\) \{/);
    expect(s).toMatch(/INCLUDING ENGLISH/);
  });
});
