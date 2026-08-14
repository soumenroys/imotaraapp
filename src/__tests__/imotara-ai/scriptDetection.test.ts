/**
 * src/__tests__/imotara-ai/scriptDetection.test.ts
 *
 * Regression tests for isRomanizedInput (P2-16, code_review_audit_2026_08_14).
 * Deterministic string-matching logic — no LLM judge needed. Extracted from
 * chat-reply/route.ts (P2-16) so it's importable here; Next.js route.ts files
 * only permit a fixed set of exports.
 */

import { describe, it, expect } from "vitest";
import { isRomanizedInput } from "@/lib/imotara/scriptDetection";

describe("isRomanizedInput", () => {
  it("detects romanized Hindi with Indic grammar markers", () => {
    expect(isRomanizedInput("kya haal hai tumhara aajkal", "hi")).toBe(true);
  });

  it("detects romanized Bengali", () => {
    expect(isRomanizedInput("ami tomake khub bhalobashi", "bn")).toBe(true);
  });

  it("does not fire on plain English with contractions, even for a target language", () => {
    expect(isRomanizedInput("I don't know what to do", "hi")).toBe(false);
  });

  it("does not fire on plain English via common-word density, even with no contractions", () => {
    expect(isRomanizedInput("I have been thinking about my life lately", "hi")).toBe(false);
  });

  it("does not fire on native-script text (no Latin letters at all)", () => {
    expect(isRomanizedInput("क्या हाल है तुम्हारा", "hi")).toBe(false);
  });

  it("does not fire for languages outside the native-script list, regardless of content", () => {
    expect(isRomanizedInput("kya haal hai", "en")).toBe(false);
    expect(isRomanizedInput("kya haal hai", "es")).toBe(false);
  });

  it("does not fire on very short messages (<=3 letters)", () => {
    expect(isRomanizedInput("hi", "hi")).toBe(false);
    expect(isRomanizedInput("ok", "hi")).toBe(false);
  });

  it("still fires on Hinglish containing borrowed English nouns (office, busy) — not treated as plain English", () => {
    expect(isRomanizedInput("aaj office mein bahut busy tha", "hi")).toBe(true);
  });

  it("detects romanized Urdu", () => {
    expect(isRomanizedInput("kya haal hai aap ka", "ur")).toBe(true);
  });

  it("returns false for an empty or whitespace-only message", () => {
    expect(isRomanizedInput("", "hi")).toBe(false);
    expect(isRomanizedInput("   ", "hi")).toBe(false);
  });
});
