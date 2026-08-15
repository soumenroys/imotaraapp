/**
 * src/__tests__/connect/translate.test.ts
 *
 * Regression test for a 2026-08-16 bug report: Connect auto-translation
 * showed completely unrelated text — "bhalo" (Bengali "good") displayed as
 * "kothay tumi" ("where are you"). Root-caused to MyMemory's crowd-sourced
 * "translation memory": querying MyMemory's own public API directly with
 * these exact inputs reproduced the bug exactly (a corrupted community
 * entry mapping "Bhalo" -> "kothay tumi" at self-reported quality 100).
 *
 * Every Connect translation surface (auto-translate-at-send, auto-translate-
 * on-view, the manual picker, on both web and mobile) funnels through this
 * one translateText() function, so this test locks in the fix for all of
 * them at once: MyMemory is no longer the practical fallback whenever
 * Google isn't configured — a general-purpose LLM translation pass now sits
 * ahead of it, with MyMemory pushed to an absolute last resort reached only
 * if both Google and OpenAI are unavailable.
 *
 * These tests verify the ENGINE PRIORITY / CONTROL FLOW via mocked fetch —
 * i.e. "does a Google failure correctly fall through to the LLM path
 * instead of jumping straight to MyMemory" — not translation quality, which
 * requires live APIs and was verified manually against the real endpoints
 * before this fix shipped (see the 2026-08-16 commit message).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { translateText } from "@/lib/connect/translate";

function googleResponse(text: string) {
  return new Response(JSON.stringify({ data: { translations: [{ translatedText: text }] } }), { status: 200 });
}
function openAIResponse(text: string) {
  return new Response(JSON.stringify({ choices: [{ message: { content: text } }] }), { status: 200 });
}
function myMemoryResponse(text: string) {
  return new Response(JSON.stringify({ responseData: { translatedText: text }, quotaFinished: false }), { status: 200 });
}

describe("translateText — engine priority", () => {
  const originalGoogleKey = process.env.GOOGLE_TRANSLATE_API_KEY;
  const originalOpenAIKey = process.env.OPENAI_API_KEY;

  beforeEach(() => {
    process.env.OPENAI_API_KEY = "test-openai-key";
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (originalGoogleKey === undefined) delete process.env.GOOGLE_TRANSLATE_API_KEY;
    else process.env.GOOGLE_TRANSLATE_API_KEY = originalGoogleKey;
    if (originalOpenAIKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = originalOpenAIKey;
  });

  it("uses Google when configured and it succeeds — never calls OpenAI or MyMemory", async () => {
    process.env.GOOGLE_TRANSLATE_API_KEY = "test-google-key";
    const fetchMock = vi.fn(async (url: string | URL) => {
      const u = url.toString();
      if (u.includes("translation.googleapis.com")) return googleResponse("হ্যালো");
      throw new Error(`unexpected fetch to ${u}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    // sourceLang "en" deliberately — NOT in ROMANIZED_LLM_LANGS, so this
    // isolates the Google path rather than hitting the romanized-LLM
    // branch first (that's covered by its own test below).
    const result = await translateText("hi", "bn", "en");
    expect(result).toBe("হ্যালো");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("no Google key configured — falls to the general LLM translator, never touches MyMemory", async () => {
    delete process.env.GOOGLE_TRANSLATE_API_KEY;
    const fetchMock = vi.fn(async (url: string | URL) => {
      const u = url.toString();
      if (u.includes("translation.googleapis.com")) throw new Error("should not call Google");
      if (u.includes("api.openai.com")) return openAIResponse("হ্যালো");
      if (u.includes("mymemory.translated.net")) throw new Error("should not reach MyMemory — LLM fallback should have handled it");
      throw new Error(`unexpected fetch to ${u}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    // sourceLang "en" — isolates the general-LLM-fallback branch from the
    // romanized-Indic branch (its own test below), which would also call
    // OpenAI but for a different reason.
    const result = await translateText("hi", "bn", "en");
    expect(result).toBe("হ্যালো");
  });

  it("Google configured but throws — falls through to the LLM fallback, not directly to MyMemory", async () => {
    process.env.GOOGLE_TRANSLATE_API_KEY = "test-google-key";
    const fetchMock = vi.fn(async (url: string | URL) => {
      const u = url.toString();
      if (u.includes("translation.googleapis.com")) throw new Error("Google is down");
      if (u.includes("api.openai.com")) return openAIResponse("হ্যালো");
      if (u.includes("mymemory.translated.net")) throw new Error("should not reach MyMemory — LLM fallback should have handled it");
      throw new Error(`unexpected fetch to ${u}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await translateText("hi", "bn", "en");
    expect(result).toBe("হ্যালো");
  });

  it("Google AND the LLM fallback both fail — MyMemory is the absolute last resort", async () => {
    process.env.GOOGLE_TRANSLATE_API_KEY = "test-google-key";
    const fetchMock = vi.fn(async (url: string | URL) => {
      const u = url.toString();
      if (u.includes("translation.googleapis.com")) throw new Error("Google is down");
      if (u.includes("api.openai.com")) throw new Error("OpenAI is down");
      if (u.includes("mymemory.translated.net")) return myMemoryResponse("হ্যালো");
      throw new Error(`unexpected fetch to ${u}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await translateText("hi", "bn", "en");
    expect(result).toBe("হ্যালো");
  });

  it("romanized Indic input always tries the romanized-LLM path first, regardless of Google key state", async () => {
    process.env.GOOGLE_TRANSLATE_API_KEY = "test-google-key";
    const fetchMock = vi.fn(async (url: string | URL) => {
      const u = url.toString();
      if (u.includes("translation.googleapis.com")) throw new Error("should not call Google before the romanized-LLM path");
      if (u.includes("api.openai.com")) return openAIResponse("good");
      throw new Error(`unexpected fetch to ${u}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    // "bn" is in ROMANIZED_LLM_LANGS and "bhalo" has no native Bengali script.
    const result = await translateText("bhalo", "en", "bn");
    expect(result).toBe("good");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0].toString()).toContain("api.openai.com");
  });
});
