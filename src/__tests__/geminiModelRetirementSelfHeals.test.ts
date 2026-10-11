/**
 * When Google retires the pinned Gemini model, the fallback must heal itself.
 *
 * 🔴 THE INCIDENT THIS DEFENDS AGAINST. The Gemini model was hardcoded as
 * "gemini-2.0-flash" in three places. Google retired it, every fallback call
 * started returning HTTP 404, and on 2026-08-22 — the moment OpenAI credits
 * ran out — the app was left with **no working engine at all**. Users got
 * template replies.
 *
 * ⏰ AND IT IS HAPPENING AGAIN. Google's notice of 2026-10-10:
 *   "[Deprecation] Gemini 3.5 Flash has been deprecated and auto-redirected"
 * `GEMINI_MODEL` defaults to exactly that model, and production has **no
 * GEMINI_MODEL environment variable set**, so production runs the default.
 * The auto-redirect is doing the work today. When it stops, this path is the
 * only thing between a deprecation notice and a second total outage.
 *
 * 🔑 WHY THIS TEST IS BEHAVIOURAL, NOT A SOURCE SCAN. The sibling test
 * `fallbackGetsARealWindow` asserts on the TEXT of aiClient.ts. That cannot
 * see whether the retry is reachable — a guard added above it, an early
 * return, or a refactor would leave the text intact and the behaviour dead.
 * So this drives the real `callImotaraAI` with a stubbed `fetch` and asserts
 * on the requests that actually leave the process.
 *
 * ⛔ A failure here means a model retirement takes the whole fallback with it.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { callImotaraAI } from "@/lib/imotara/aiClient";

const PINNED = "gemini-3.5-flash";
const ALIAS = "gemini-flash-latest";

/** The model name lives in the Gemini URL path. */
function geminiModelOf(url: string): string | null {
    const m = url.match(/\/v1beta\/models\/([^:]+):generateContent/);
    return m ? m[1] : null;
}

function geminiOk(text: string): Response {
    return new Response(
        JSON.stringify({
            candidates: [
                { content: { parts: [{ text }] }, finishReason: "STOP" },
            ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
    );
}

const realFetch = globalThis.fetch;
const savedEnv: Record<string, string | undefined> = {};

/** Every model the process actually asked for, in order. */
let askedModels: string[] = [];

beforeEach(() => {
    askedModels = [];
    for (const k of [
        "OPENAI_API_KEY", "GEMINI_API_KEY", "GEMINI_MODEL", "GEMINI_FALLBACK_MODEL",
        "ALERT_GMAIL_USER", "ALERT_GMAIL_APP_PASSWORD",
    ]) {
        savedEnv[k] = process.env[k];
    }
    process.env.OPENAI_API_KEY = "test-openai-key";
    process.env.GEMINI_API_KEY = "test-gemini-key";
    // ⚠️ Deliberately cleared. sendOutageAlert sends a REAL email when these
    // are present, and this test provokes two alert paths on purpose.
    delete process.env.ALERT_GMAIL_USER;
    delete process.env.ALERT_GMAIL_APP_PASSWORD;
    // Pin the defaults the production build runs, so a changed default is
    // visible here rather than silently retargeting the test.
    delete process.env.GEMINI_MODEL;
    delete process.env.GEMINI_FALLBACK_MODEL;
    vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
    globalThis.fetch = realFetch;
    for (const [k, v] of Object.entries(savedEnv)) {
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
    }
    vi.restoreAllMocks();
});

/**
 * @param geminiStatusFor what each Gemini model should return
 */
function stubFetch(geminiStatusFor: (model: string) => Response) {
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("api.openai.com")) {
            // OpenAI is down — this is what sends the reply to Gemini at all.
            return new Response("upstream error", { status: 500 });
        }
        const model = geminiModelOf(url);
        if (model) {
            askedModels.push(model);
            return geminiStatusFor(model);
        }
        throw new Error(`unexpected request in test: ${url}`);
    }) as unknown as typeof fetch;
}

describe("🔴 a retired Gemini model must not take the fallback down with it", () => {
    it("404 on the pinned model ⇒ retries the rolling alias and answers", async () => {
        stubFetch((model) =>
            model === PINNED
                ? new Response(JSON.stringify({ error: { message: "model not found" } }), { status: 404 })
                : geminiOk("I am here with you."),
        );

        const res = await callImotaraAI("hello");

        // The point of the whole mechanism: a real reply still reaches the user.
        expect(res.text).toBe("I am here with you.");
        expect(res.meta.usedModel).toBe(ALIAS);
        // ⚠️ Order matters: pinned first, alias second. Asserting only
        // "contains ALIAS" would pass if the pinned model were skipped
        // entirely, which would silently drop the fast path.
        expect(askedModels).toEqual([PINNED, ALIAS]);
    });

    it("⛔ the alias is NOT tried when Gemini is merely unhealthy (500)", async () => {
        // 404 means "this model is gone". 500 means "Gemini is having a bad
        // day" — retrying a second model then burns the remaining budget for
        // nothing and makes a slow failure slower.
        stubFetch(() => new Response("boom", { status: 500 }));

        const res = await callImotaraAI("hello");

        expect(askedModels).toEqual([PINNED]);
        expect(res.text).toBe("");
    });

    it("⛔ both models gone ⇒ reports a total outage, never a silent success", async () => {
        stubFetch(() => new Response(JSON.stringify({ error: { message: "gone" } }), { status: 404 }));

        const res = await callImotaraAI("hello");

        expect(askedModels).toEqual([PINNED, ALIAS]);
        expect(res.text).toBe("");
        expect(res.meta.from).toBe("error");
    });
});

describe("⚠️ the two defaults these tests pin", () => {
    it("🔑 the pinned model and the rolling alias are what production runs", async () => {
        // Production sets NEITHER GEMINI_MODEL nor GEMINI_FALLBACK_MODEL
        // (verified against the Vercel project 2026-10-11), so the source
        // defaults ARE the production configuration. If someone changes a
        // default, this test should be the thing that notices — otherwise the
        // assertions above quietly start testing a different pair of models.
        stubFetch((model) =>
            model === PINNED
                ? new Response("{}", { status: 404 })
                : geminiOk("ok"),
        );
        await callImotaraAI("hello");
        expect(askedModels[0]).toBe(PINNED);
        expect(askedModels[1]).toBe(ALIAS);
    });

    it("⛔ the alias must be a ROLLING alias, not a pinned version", () => {
        // The whole point of the last-resort model is that it cannot rot the
        // way a pinned name does. A version number here would reintroduce the
        // 2026-08-22 failure one retirement later.
        expect(ALIAS).not.toMatch(/\d+\.\d+/);
        expect(ALIAS).toMatch(/latest/);
    });
});
