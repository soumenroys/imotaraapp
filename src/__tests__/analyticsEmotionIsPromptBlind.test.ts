/**
 * The analytics emotion label must NEVER reach the reply prompt.
 *
 * 🔴 WHY THIS EXISTS. `/api/chat-reply` holds two different emotion values that
 * look almost identical and want the same variable name:
 *
 *   1. `emotion`               — what the CLIENT sent. Feeds `emotionHint`,
 *                                which is spliced into the SYSTEM PROMPT.
 *   2. `analyticsEmotionLabel` — derived SERVER-SIDE from the user's message,
 *                                written only to usage_events for the EDU/NGO
 *                                "mindset trend".
 *
 * (2) exists because the trend was running on 6.4% of conversations (27 labels
 * across 422 production chat replies on 2026-10-05) — web sent no emotion at
 * all, and mobile only on a keyword hit.
 *
 * If (2) is ever passed to `emotionHint`, an analytics improvement silently
 * becomes a change to every reply: far more conversations would carry an
 * emotion directive into the prompt, with no commit that looks like a reply
 * change. That is exactly the failure mode the owner ruled out on 2026-10-05,
 * verbatim: "at any cost the reply quality and user experience should not be
 * degraded. time is not critical, quality is."
 *
 * So the safety property is STRUCTURAL, not behavioural: the model's input is
 * byte-identical whether or not the analytics derivation exists. This test
 * fails the build if that stops being true.
 *
 * Sibling of replyQualityIsTierBlind.test.ts, which guards the same surface
 * against a different intruder (licensing tier).
 */

import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const ROUTE = path.join(process.cwd(), "src/app/api/chat-reply/route.ts");
const SRC = fs.readFileSync(ROUTE, "utf8");
const LINES = SRC.split("\n");

/** Lines of real code mentioning a token — comments stripped out. */
function codeLinesWith(token: string): string[] {
  return LINES.filter((l) => {
    const trimmed = l.trim();
    if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*")) return false;
    return l.includes(token);
  });
}

describe("the derived analytics label is quarantined from the prompt", () => {
  it("is actually wired up (guards against the guard passing vacuously)", () => {
    expect(SRC).toContain("deriveAnalyticsEmotion");
    expect(codeLinesWith("deriveAnalyticsEmotion").length).toBeGreaterThan(0);
  });

  it("appears in exactly two places: its declaration and the usage_events insert", () => {
    // If this count grows, something new is reading the analytics label —
    // which is the moment to check whether that something feeds the model.
    const uses = codeLinesWith("analyticsEmotionLabel");
    expect(uses.length).toBe(2);
  });

  it("is never mentioned on a line that also builds the prompt hint", () => {
    const bad = codeLinesWith("analyticsEmotionLabel").filter((l) =>
      l.includes("emotionHint") || l.includes("emotionDescriptions"),
    );
    expect(bad).toEqual([]);
  });

  it("is not passed into any system/prompt/messages assembly", () => {
    const bad = codeLinesWith("analyticsEmotionLabel").filter((l) =>
      /system|prompt|messages|openai|gpt|temperature/i.test(l),
    );
    expect(bad).toEqual([]);
  });
});

describe("the prompt still reads ONLY the client-supplied emotion", () => {
  it("builds emotionHint from the client value, not the derived one", () => {
    const hintDecl = LINES.findIndex((l) => /const\s+emotionHint\s*=/.test(l));
    expect(hintDecl).toBeGreaterThan(-1);
    // The declaration plus a couple of continuation lines.
    const decl = LINES.slice(hintDecl, hintDecl + 4).join("\n");
    expect(decl).not.toContain("analyticsEmotionLabel");
    expect(decl).not.toContain("deriveAnalyticsEmotion");
  });

  it("keeps the client hint sourced from the request body", () => {
    expect(SRC).toMatch(/const\s+emotion\s*=\s*\(body\?\.emotion/);
  });
});

describe("the usage_events insert records the derived label", () => {
  it("writes the derived label, not the client hint", () => {
    const insertIdx = LINES.findIndex((l) => l.includes('event_type: "chat_reply"'));
    expect(insertIdx).toBeGreaterThan(-1);
    const block = LINES.slice(insertIdx - 2, insertIdx + 8).join("\n");
    expect(block).toContain("analyticsEmotionLabel");
  });

  it('no longer writes the empty string when nothing is detected', () => {
    // The old expression was `emotion?.toLowerCase() ?? null`, which passes ""
    // straight through because `?.` and `??` only catch null/undefined. Empty
    // strings then slipped past the org route's .not("emotion","is",null)
    // filter, so it fetched every chat row and discarded it.
    expect(SRC).not.toContain("emotion:    emotion?.toLowerCase() ?? null");
  });

  it("still runs fire-and-forget, off the reply's critical path", () => {
    const insertIdx = LINES.findIndex((l) => l.includes('event_type: "chat_reply"'));
    const block = LINES.slice(Math.max(0, insertIdx - 6), insertIdx).join("\n");
    expect(block).toContain("void Promise.resolve");
    expect(block).not.toContain("await ");
  });
});
