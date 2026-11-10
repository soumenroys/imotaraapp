/**
 * #117 (10 Nov 2026): a reply that OUR time limit cut off is not an OpenAI
 * outage.
 *
 * 🔴 THE INCIDENT. 9 Nov 23:27 IST (and 26 Oct before it): info@ received
 * "🔴 ALERT: OpenAI API unavailable — Gemini fallback active", reason
 * "This operation was aborted". That reason is our own AbortController — the
 * time budget or the stall guard — giving up on ONE slow reply. OpenAI was up.
 * Calling it an outage alarms the owner for nothing, and an alert that cries
 * wolf is the one nobody reads on the day it is real.
 *
 * 🔑 BEHAVIOURAL, NOT A SOURCE SCAN: this drives the real callImotaraAI and
 * streamImotaraAI with a stubbed fetch and reads the alert line they log.
 * A text test would stay green if the classification were added below an
 * early return ⇒ trap_text_assertions_cannot_see_reachability.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { callImotaraAI, streamImotaraAI } from "@/lib/imotara/aiClient";
import { alertKindForOpenAIError } from "@/lib/imotara/openaiAlertKind";

const realFetch = globalThis.fetch;
const savedEnv: Record<string, string | undefined> = {};
let errorLines: string[] = [];

function abortError(): Error {
    // What fetch rejects with when our AbortController fires.
    return new DOMException("This operation was aborted", "AbortError") as unknown as Error;
}

function geminiOk(): Response {
    return new Response(
        JSON.stringify({ candidates: [{ content: { parts: [{ text: "I'm here." }] }, finishReason: "STOP" }] }),
        { status: 200, headers: { "Content-Type": "application/json" } },
    );
}

/** OpenAI behaves as `openai`; every Gemini call answers (or fails, for streams). */
function stubFetch(openai: () => Promise<Response>) {
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("api.openai.com")) return openai();
        if (url.includes("generativelanguage.googleapis.com")) {
            // Streams: a plain failure keeps the test about the OpenAI alert only.
            return url.includes("streamGenerateContent")
                ? new Response("no", { status: 500 })
                : geminiOk();
        }
        throw new Error(`unexpected request in test: ${url}`);
    }) as unknown as typeof fetch;
}

const alertLines = () => errorLines.filter((l) => l.startsWith("[imotara][alert]"));

beforeEach(() => {
    errorLines = [];
    for (const k of ["OPENAI_API_KEY", "GEMINI_API_KEY", "ALERT_GMAIL_USER", "ALERT_GMAIL_APP_PASSWORD"]) {
        savedEnv[k] = process.env[k];
    }
    process.env.OPENAI_API_KEY = "test-openai-key";
    process.env.GEMINI_API_KEY = "test-gemini-key";
    // ⚠️ Cleared on purpose: with these set, sendOutageAlert sends a REAL email.
    // Without them it still logs the alert line, which is what we read.
    delete process.env.ALERT_GMAIL_USER;
    delete process.env.ALERT_GMAIL_APP_PASSWORD;
    vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
        errorLines.push(args.map(String).join(" "));
    });
    vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
    globalThis.fetch = realFetch;
    for (const [k, v] of Object.entries(savedEnv)) {
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
    }
    vi.restoreAllMocks();
});

describe("alertKindForOpenAIError", () => {
    it("our own abort or a timeout ⇒ slow", () => {
        expect(alertKindForOpenAIError(abortError())).toBe("openai_slow");
        expect(alertKindForOpenAIError({ name: "TimeoutError", message: "x" })).toBe("openai_slow");
        expect(alertKindForOpenAIError(new Error("This operation was aborted"))).toBe("openai_slow");
        expect(alertKindForOpenAIError(new Error("request timed out"))).toBe("openai_slow");
    });

    it("a refused connection or anything else ⇒ still down", () => {
        expect(alertKindForOpenAIError(new TypeError("fetch failed"))).toBe("openai_down");
        expect(alertKindForOpenAIError(new Error("getaddrinfo ENOTFOUND api.openai.com"))).toBe("openai_down");
        expect(alertKindForOpenAIError(undefined)).toBe("openai_down");
    });
});

describe("🔴 the alert that actually fires", () => {
    it("callImotaraAI: an aborted OpenAI call is reported as SLOW, never as an outage", async () => {
        stubFetch(async () => { throw abortError(); });
        await callImotaraAI("hello");
        const lines = alertLines();
        expect(lines.some((l) => l.includes("OpenAI reply slow") && l.includes("Not an outage"))).toBe(true);
        expect(lines.some((l) => l.includes("OpenAI unavailable"))).toBe(false);
    });

    it("callImotaraAI: a real network failure is still an outage", async () => {
        stubFetch(async () => { throw new TypeError("fetch failed"); });
        await callImotaraAI("hello");
        expect(alertLines().some((l) => l.includes("OpenAI unavailable"))).toBe(true);
    });

    it("callImotaraAI: an HTTP 500 from OpenAI is still an outage", async () => {
        stubFetch(async () => new Response("upstream error", { status: 500 }));
        await callImotaraAI("hello");
        expect(alertLines().some((l) => l.includes("OpenAI unavailable"))).toBe(true);
        expect(alertLines().some((l) => l.includes("OpenAI reply slow"))).toBe(false);
    });

    it("streamImotaraAI: an abort before the first token is reported as SLOW", async () => {
        stubFetch(async () => { throw abortError(); });
        for await (const _ of streamImotaraAI("hello")) { /* drain */ }
        const lines = alertLines();
        expect(lines.some((l) => l.includes("OpenAI reply slow"))).toBe(true);
        expect(lines.some((l) => l.includes("OpenAI unavailable"))).toBe(false);
    });
});
