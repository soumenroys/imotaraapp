/**
 * 🔑 THE CACHE KEY CHANGES THE BILL, NEVER THE REPLY — owner, 29 Oct 2026:
 * "at any cost the reply quality and user experience should not be compromised".
 *
 * Two model bake-offs that day (gpt-4.1-mini, gpt-5.4-mini; 66 messages × 22
 * languages) both changed how Imotara answers, so the model stays gpt-4.1. The
 * one saving that cannot alter a reply is OpenAI's `prompt_cache_key`: it only
 * helps requests sharing the same ~60K-token framework reach the same cache.
 * ⇒ This pins that the request is otherwise byte-for-byte what it was.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

afterEach(() => vi.unstubAllGlobals());

function capture() {
  const bodies: Record<string, unknown>[] = [];
  vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
    if (String(url).includes("/v1/chat/completions")) {
      bodies.push(JSON.parse(String(init?.body)));
      return new Response(JSON.stringify({ choices: [{ message: { content: "I hear you." } }], model: "gpt-4.1-2025-04-14", usage: {} }), { status: 200, headers: { "content-type": "application/json" } });
    }
    return new Response("{}", { status: 200 });
  });
  return bodies;
}

describe("prompt_cache_key", () => {
  it("is sent, named per feature, and the rest of the request is unchanged", async () => {
    process.env.OPENAI_API_KEY = "sk-test";
    process.env.IMOTARA_AI_MODEL = "gpt-4.1";
    const bodies = capture();
    const { callImotaraAI } = await import("@/lib/imotara/aiClient");
    await callImotaraAI("hello", { system: "SYS", maxTokens: 123, temperature: 0.7, noFallback: true });
    await callImotaraAI("hello", { system: "SYS", maxTokens: 123, temperature: 0.7, noFallback: true, feature: "outreach" });

    expect(bodies).toHaveLength(2);
    const [chat, outreach] = bodies;
    expect(chat.prompt_cache_key).toBe("imotara-chat");
    expect(outreach.prompt_cache_key).toBe("imotara-outreach");
    // ⛔ Everything that shapes the reply is exactly as before.
    const { prompt_cache_key: _k, ...rest } = chat;
    expect(rest).toEqual({
      model: "gpt-4.1",
      messages: [{ role: "system", content: "SYS" }, { role: "user", content: "hello" }],
      max_tokens: 123,
      temperature: 0.7,
    });
  });

  it("the streaming path (web chat) sends it too", () => {
    const src = readFileSync(join(process.cwd(), "src/lib/imotara/aiClient.ts"), "utf8");
    expect(src).toMatch(/stream: true,\s*prompt_cache_key: promptCacheKey\(options\.feature\)/);
  });
});
