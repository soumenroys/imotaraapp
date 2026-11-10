// src/lib/imotara/openaiAlertKind.ts
//
// ⚠️ Its own module because aiClient.ts is "use server": a "use server" file may
// export only async functions, and a plain export there fails `next build`
// while vitest and tsc stay green ⇒ trap_use_server_file_exports_only_async.

/**
 * 🔴 #117 (10 Nov 2026): a reply that OUR time limit cut off is not an OpenAI
 * outage. On 9 Nov 23:27 IST (and on 26 Oct) info@ got "OpenAI API unavailable
 * — Gemini fallback active" with the reason "This operation was aborted" — that
 * is our own AbortController (time budget or stall guard) firing on one slow
 * reply, while OpenAI itself was fine. Calling it an outage alarms the owner
 * for nothing. An abort or timeout is "slow"; an HTTP error or a refused
 * connection is still "down".
 */
export function alertKindForOpenAIError(err: unknown): "openai_down" | "openai_slow" {
  const e = err as { name?: unknown; message?: unknown } | null | undefined;
  const name = typeof e?.name === "string" ? e.name : "";
  const message = typeof e?.message === "string" ? e.message : typeof err === "string" ? err : "";
  if (name === "AbortError" || name === "TimeoutError") return "openai_slow";
  if (/\babort(ed)?\b|\btimed? ?out\b/i.test(message)) return "openai_slow";
  return "openai_down";
}
