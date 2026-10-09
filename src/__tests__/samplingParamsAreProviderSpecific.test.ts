/**
 * `temperature` is NOT a deprecated parameter to tidy away. On the path users
 * actually hit, it is the companion's voice.
 *
 * 🔴 WHY THIS EXISTS — I nearly caused the thing it prevents. On 2026-10-07
 * Google AI Studio sent "[Action Required] Update thinking_budget and sampling
 * parameters", saying:
 *
 *     "Since Gemini 3.6 Flash, sampling parameters have been set to default
 *      values, so custom values have had no effect on model output. Soon …
 *      requests that include temperature, top_p, and top_k will return an error."
 *
 * I read that and proposed removing `temperature`. The owner asked me to check
 * what it was actually doing first. It turns out SIX call sites send it and
 * only TWO are Gemini:
 *
 *   OpenAI — PRIMARY, where temperature genuinely works
 *     callImotaraAI      0.7   the JSON reply path (mobile)
 *     streamImotaraAI    0.7   the streaming reply path (web)
 *     connect/translate  0     deterministic translation, twice
 *   Gemini — FALLBACK ONLY, reached when OpenAI is absent or errors
 *     geminiAttempt      0.7
 *     streamGeminiModel  0.7
 *
 * Removing them all would have pushed the primary companion path from 0.7 to
 * OpenAI's 1.0 default — measurably more random replies on web AND mobile —
 * and made Connect translation non-deterministic. A Google deprecation notice
 * about Gemini would have silently changed the character of replies that never
 * touch Gemini.
 *
 * ⚠️ AND THE GEMINI HALF IS NOT FREE EITHER. Google's statement is scoped to
 * "since Gemini 3.6 Flash". `GEMINI_MODEL` is UNSET in production, so we run
 * the hardcoded default `gemini-3.5-flash` — BEFORE 3.6, where temperature is
 * most likely still honoured. So this test does not demand its removal from
 * Gemini either. It pins the distinction, not a cleanup.
 *
 * What is safe, and what this test allows, is the retry: see GeminiAttemptMode.
 */

import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const read = (f: string) =>
  fs.readFileSync(path.join(process.cwd(), f), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

const AI = "src/lib/imotara/aiClient.ts";
const TRANSLATE = "src/lib/connect/translate.ts";

describe("🔴 OpenAI is the PRIMARY provider and Gemini only the fallback", () => {
  it("callImotaraAI reaches Gemini only when OpenAI is missing or fails", () => {
    const s = read(AI);
    // no key → Gemini; HTTP error → Gemini; throw → Gemini. Never first.
    expect(s).toMatch(/if \(!apiKey\)[\s\S]{0,200}callGeminiAI\(/);
    // ⚠️ Window widened 2026-10-09: the client-budget guard (`if
    // (!plan.fallbackEnabled)`) now legitimately sits between the failure
    // check and the hop. Still BOUNDED — an unbounded [\s\S]* would match a
    // callGeminiAI anywhere in the file and assert nothing.
    expect(s).toMatch(/!response\.ok[\s\S]{0,1200}callGeminiAI\(/);
  });

  it("the OpenAI endpoint is what callImotaraAI calls", () => {
    expect(read(AI)).toMatch(/api\.openai\.com/);
  });
});

describe("🔴 the PRIMARY reply path keeps its sampling temperature", () => {
  /**
   * If either of these ever reads `?? 1` or loses the field, replies get more
   * random on the surface the user actually meets. That is the one thing the
   * owner has said must never regress.
   */
  it("both OpenAI paths default temperature to 0.7", () => {
    const s = read(AI);
    const hits = [...s.matchAll(/typeof options\.temperature === "number" \? options\.temperature : ([\d.]+)/g)];
    // four sites read it: 2 OpenAI + 2 Gemini. None may default to anything else.
    expect(hits.length).toBeGreaterThanOrEqual(4);
    for (const h of hits) expect(h[1]).toBe("0.7");
  });

  it("the OpenAI request bodies still send it", () => {
    // ⚠️ REWRITTEN 2026-10-09. This asserted PROXIMITY — `api.openai.com`
    // within 3000 characters of `temperature,` — and broke the moment a long
    // comment block was added between the base-URL constant and the request
    // body, while the behaviour was completely unchanged. A test that fails on
    // the distance between two lines is measuring the file's layout, not the
    // request. Assert the BODIES instead.
    const s = read(AI);
    const chatBodies = [...s.matchAll(/body: JSON\.stringify\(\{[\s\S]{0,800}?\}\),/g)]
      .map((m) => m[0])
      // `messages:` is the OpenAI chat shape; Gemini's bodies use `contents`.
      // (`model` is passed shorthand, so it is not a usable discriminator.)
      .filter((b) => /messages:/.test(b));
    // one for callImotaraAIPrimary, one for streamImotaraAIPrimary
    expect(chatBodies.length).toBeGreaterThanOrEqual(2);
    for (const body of chatBodies) expect(body).toMatch(/temperature,/);
  });
});

describe("🔴 Connect translation stays deterministic", () => {
  it("both translate calls pin temperature to 0", () => {
    const s = read(TRANSLATE);
    // ⚠️ /temperature:\s*0\b/ ALSO matches "temperature: 0.7" — \b falls between
    // the 0 and the dot. Mutating 0 → 0.7 left this green. Anchor on the comma.
    const zeros = [...s.matchAll(/temperature:\s*0\s*,/g)];
    expect(zeros.length).toBe(2);
    expect(s).not.toMatch(/temperature:\s*0\.\d/);
  });

  it("…and they go to OpenAI, not Gemini — so the Gemini notice does not apply", () => {
    const s = read(TRANSLATE);
    expect(s).toMatch(/openAIBaseUrl\(\)|api\.openai\.com/);
    expect(s).toMatch(/gpt-4\.1-mini/);
  });
});

describe("✅ the Gemini RETRY may carry nothing a future model can reject", () => {
  it("the fast attempt still sends temperature and the thinking budget", () => {
    const s = read(AI);
    expect(s).toMatch(/mode === "fast"[\s\S]{0,120}temperature,\s*thinkingConfig/);
  });

  it("🔑 the minimal retry sends maxOutputTokens and nothing else", () => {
    const s = read(AI);
    // ⚠️ BOTH bodies, counted. A single toMatch found the streaming block when
    // the non-streaming one was mutated, so the guard passed while the bug was
    // present — the same no-teeth failure as the org_members insert earlier.
    const emptyElse = [...s.matchAll(/mode === "fast"\s*\?\s*\{ temperature, thinkingConfig: \{ thinkingBudget: 0 \} \}\s*:\s*\{\}\s*\),/g)];
    expect(emptyElse.length).toBe(2);
  });

  it("⚠️ maxOutputTokens survives into the retry — it is the truncation guard", () => {
    const s = read(AI);
    // it sits OUTSIDE the mode ternary in both bodies
    const bodies = [...s.matchAll(/generationConfig:\s*\{\s*maxOutputTokens: maxTokens,/g)];
    expect(bodies.length).toBe(2);
  });

  it("both retries ask for minimal, not for 'thinking enabled'", () => {
    const s = read(AI);
    expect([...s.matchAll(/"minimal",/g)].length).toBe(2);
    expect(s).not.toMatch(/disableThinking/);
  });

  it("the ceiling itself is unchanged", async () => {
    const s = read(AI);
    expect(s).toMatch(/GEMINI_MIN_OUTPUT_TOKENS = 1200/);
    // applied on both Gemini paths
    expect([...s.matchAll(/Math\.max\(options\.maxTokens \?\? 350, GEMINI_MIN_OUTPUT_TOKENS\)/g)].length).toBe(2);
  });
});

describe("⛔ we send no top_p / top_k anywhere, so that third of the notice is moot", () => {
  it.each([AI, TRANSLATE])("%s sends neither", (f) => {
    const s = read(f);
    expect(s).not.toMatch(/\btop_p\b|\btopP\b/);
    expect(s).not.toMatch(/\btop_k\b|\btopK\b/);
  });
});
