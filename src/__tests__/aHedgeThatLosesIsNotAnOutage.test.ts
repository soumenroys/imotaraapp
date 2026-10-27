/**
 * 🔴 26 Oct 2026, 23:55 IST: "TOTAL AI OUTAGE — both OpenAI and Gemini are
 * failing" was mailed while replies were working.
 *
 * At a tight client budget the AI client starts Gemini ALONGSIDE a slow OpenAI
 * call (the hedge), with only the time left — about a second or two. When that
 * hedge timed out, callGeminiAI assumed it was the fallback after OpenAI had
 * failed and raised a TOTAL OUTAGE, even though OpenAI then answered normally.
 *
 * ✅ A losing hedge is now a warning. A REAL outage — OpenAI fails, then its
 * own Gemini fallback fails — still raises the alert (second test).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const saved = { ...process.env };

function abortable(signal: AbortSignal | undefined, after: number, body: () => Response): Promise<Response> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => resolve(body()), after);
    signal?.addEventListener("abort", () => {
      clearTimeout(t);
      const e = new Error("This operation was aborted");
      e.name = "AbortError";
      reject(e);
    });
  });
}

const openaiOk = () =>
  new Response(JSON.stringify({ choices: [{ message: { content: "That sounds like a heavy day. I'm here." }, finish_reason: "stop" }] }), {
    status: 200, headers: { "Content-Type": "application/json" },
  });

describe("a Gemini hedge that loses is not an outage", () => {
  let errors: string[];
  beforeEach(() => {
    vi.resetModules();
    process.env.OPENAI_API_KEY = "test-openai";
    process.env.GEMINI_API_KEY = "test-gemini";
    delete process.env.ALERT_GMAIL_USER;
    delete process.env.ALERT_GMAIL_APP_PASSWORD;
    errors = [];
    vi.spyOn(console, "error").mockImplementation((...a: unknown[]) => { errors.push(a.map(String).join(" ")); });
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    process.env = { ...saved };
  });

  it("OpenAI answers late, the hedge times out ⇒ the reply is OpenAI's and NO outage alert", async () => {
    // 7s client budget ⇒ OpenAI gets 5.5s, the hedge starts at 2s with ~3.5s.
    vi.stubGlobal("fetch", vi.fn((url: string, init?: RequestInit) =>
      String(url).includes("generativelanguage")
        ? abortable(init?.signal ?? undefined, 60_000, openaiOk) // never answers in time
        : abortable(init?.signal ?? undefined, 4_800, openaiOk),
    ));
    const { callImotaraAI } = await import("@/lib/imotara/aiClient");
    const r = await callImotaraAI("I had a long day.", { clientBudgetMs: 7_000 });
    expect(r.meta.from).toBe("openai");
    // Let the hedge's own timeout fire after OpenAI has answered.
    await new Promise((res) => setTimeout(res, 1_200));
    expect(errors.filter((e) => e.includes("TOTAL OUTAGE"))).toEqual([]);
  }, 15_000);

  it("✅ a REAL outage still alerts: OpenAI fails, then its Gemini fallback fails", async () => {
    vi.stubGlobal("fetch", vi.fn((url: string) =>
      Promise.resolve(String(url).includes("generativelanguage")
        ? new Response("unavailable", { status: 503 })
        : new Response("server error", { status: 500 })),
    ));
    const { callImotaraAI } = await import("@/lib/imotara/aiClient");
    const r = await callImotaraAI("I had a long day.");
    expect(r.text).toBe("");
    expect(errors.some((e) => e.includes("TOTAL OUTAGE"))).toBe(true);
  }, 15_000);
});
