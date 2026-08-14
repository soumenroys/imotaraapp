/**
 * src/__tests__/imotara-ai/badPlaceholderText.test.ts
 *
 * Regression tests for isBadPlaceholderText (P2-20, code_review_audit_2026_08_14).
 * Now shared between the server (chat-reply's non-streaming path) and the web
 * client (respondRemote.ts's streaming consumer) — both must reject the exact
 * same set of known-bad strings.
 */

import { describe, it, expect } from "vitest";
import { isBadPlaceholderText } from "@/lib/imotara/response/badPlaceholderText";

describe("isBadPlaceholderText", () => {
  it("flags empty or whitespace-only text", () => {
    expect(isBadPlaceholderText("")).toBe(true);
    expect(isBadPlaceholderText("   ")).toBe(true);
  });

  it("flags the known placeholder strings", () => {
    expect(isBadPlaceholderText("This is a soft, placeholder reply for now.")).toBe(true);
    expect(isBadPlaceholderText("I tried to connect to Imotara's AI engine but failed.")).toBe(true);
    expect(isBadPlaceholderText("Something happened, but something went wrong on our end.")).toBe(true);
  });

  it("does not flag a normal, real reply", () => {
    expect(isBadPlaceholderText("Hey, I'm doing well, thanks for asking! What's on your mind today?")).toBe(false);
  });

  it("does not flag real text that happens to share unrelated words", () => {
    expect(isBadPlaceholderText("I went wrong at the last turn, but found my way back.")).toBe(false);
  });
});
