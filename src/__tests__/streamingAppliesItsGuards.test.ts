/**
 * The guards must live on the path that actually runs.
 *
 * 🔴 THE SHAPE OF THE PROBLEM, found 2026-10-09. Both clients call
 * `/api/chat-reply?stream=1` FIRST — web (respondRemote.ts:233) and mobile
 * (aiClient.ts:486). The JSON path is the fallback. Yet every post-processing
 * guard lived on the JSON path:
 *
 *   · the romanized non-ASCII strip        route.ts:3789
 *   · noQuestions on closure turns         passed only at the JSON call
 *   · isBadPlaceholderText                 route.ts:3736
 *   · formatImotaraReply                   route.ts:3794
 *
 * The streaming branch justified this with "All script-safety rules are in
 * the system prompt". The strip it skips carries the refutation in its own
 * comment:
 *
 *     "achi।tomar" became "achitomar" … observed on a device 2026-09-12
 *
 * A leak that happened WITH the prompt rules in force. The prompt reduces
 * leaks; it does not stop them.
 *
 * ── WHAT CAN AND CANNOT BE PORTED ───────────────────────────────────────
 *
 * ✅ The strip is character-level, so it works per token — each SSE token is
 *    a complete JS string.
 *
 * ✅ noQuestions is recovered by NOT STREAMING closure turns. It operates on
 *    whole sentences (aiClient.ts:392), which a stream cannot do: by the time
 *    you know a sentence was a question you have sent it. Closure replies are
 *    capped at 80 tokens, so the whole reply arrives in about the time the
 *    first streamed token would have. Near-zero cost, real guard.
 *
 * ⏸ isBadPlaceholderText is NOT ported, deliberately. It needs the whole text,
 *    and a stream cannot be retracted. Doing it properly means buffering the
 *    head of every reply before emitting anything — a latency cost on every
 *    message to catch a rare failure. Left open on purpose rather than
 *    half-done.
 */

import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const raw = (f: string) => fs.readFileSync(path.join(process.cwd(), f), "utf8");
const code = (f: string) =>
  raw(f).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const ROUTE = "src/app/api/chat-reply/route.ts";

describe("🔴 closure turns keep their no-questions guard", () => {
  it("a closure turn does NOT take the streaming branch", () => {
    const s = code(ROUTE);
    expect(s).toMatch(
      /requestUrl\.searchParams\.get\("stream"\) === "1" && !isClosureIntent/,
    );
  });

  it("…so it reaches the JSON call, which passes noQuestions", () => {
    const s = code(ROUTE);
    expect(s).toMatch(/noQuestions: isClosureIntent/);
  });

  it("⚠️ and noQuestions really is whole-sentence work, not per-token", () => {
    // The justification for not streaming closure turns. If this ever becomes
    // token-safe, the bypass can go.
    const ai = code("src/lib/imotara/aiClient.ts");
    expect(ai).toMatch(/options\.noQuestions && text/);
    expect(ai).toMatch(/text\.split\(\/\(\?<=\[\.!\?\]\)\\s\+\//);
  });
});

describe("🔴 romanized replies are stripped on the streaming path too", () => {
  it("each token is stripped when the input was romanized", () => {
    const s = code(ROUTE);
    expect(s).toMatch(/const outToken = isRomanInput/);
    expect(s).toMatch(/token\.replace\(\/\[\^\\x00-\\x7F\]\/g, " "\)/);
  });

  it("🔑 the STRIPPED token is what gets sent, not the original", () => {
    // The whole fix in one assertion: computing outToken and then enqueueing
    // `token` would look right and do nothing.
    const s = code(ROUTE);
    expect(s).toMatch(/JSON\.stringify\(\{ t: outToken \}\)/);
    expect(s).not.toMatch(/JSON\.stringify\(\{ t: token \}\)/);
  });

  it("⚠️ it replaces with a SPACE — deleting is what glued the words", () => {
    // "achi।tomar" -> "achitomar" is the recorded device bug. A strip to ""
    // reintroduces it exactly.
    const s = code(ROUTE);
    expect(s).not.toMatch(/token\.replace\(\/\[\^\\x00-\\x7F\]\/g, ""\)/);
  });

  it("✅ a non-romanized reply is passed through untouched", () => {
    // Native script replies MUST keep their script. Stripping them would
    // destroy every Bengali, Hindi and Tamil reply in the product.
    const s = code(ROUTE);
    expect(s).toMatch(/isRomanInput\s*\?\s*token\.replace\([^)]*\)\s*:\s*token/);
  });

  it("the per-token strip behaves like the JSON path's on a real leak", () => {
    const strip = (t: string) => t.replace(/[^\x00-\x7F]/g, " ");
    // the exact recorded failure
    expect(strip("achi।tomar")).toBe("achi tomar");
    // em-dash and ellipsis do the same thing
    expect(strip("ami—tomar")).toBe("ami tomar");
    expect(strip("bhalo…achi")).toBe("bhalo achi");
    // plain ASCII is untouched
    expect(strip("ami tomar shathe achi.")).toBe("ami tomar shathe achi.");
  });
});

describe("⏸ what was deliberately NOT done", () => {
  it("isBadPlaceholderText still guards the JSON path only", () => {
    // Recorded so the gap is a decision, not an oversight. Porting it means
    // buffering the head of every reply — a cost on all messages to catch a
    // rare one.
    const s = code(ROUTE);
    expect(s).toMatch(/isBadPlaceholderText\(candidate\)/);
  });
});
