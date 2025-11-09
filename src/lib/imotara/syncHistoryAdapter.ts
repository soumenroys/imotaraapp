// src/lib/imotara/syncHistoryAdapter.ts
import * as mod from "./syncHistory";

/**
 * Normalized syncHistory function:
 * - uses named export `syncHistory` if present
 * - otherwise uses default export if it is a function
 */
export async function syncHistory(remoteRaw: unknown): Promise<unknown> {
  const anyMod = mod as unknown as Record<string, unknown>;
  const named = anyMod["syncHistory"];
  const def = (anyMod as { default?: unknown }).default;

  const fn =
    typeof named === "function" ? (named as (x: unknown) => Promise<unknown> | unknown)
    : typeof def === "function" ? (def as (x: unknown) => Promise<unknown> | unknown)
    : null;

  if (!fn) {
    // fall back to passthrough to avoid hard crash
    console.warn("[imotara] syncHistory adapter: no function export found, returning input");
    return remoteRaw;
  }
  return await fn(remoteRaw);
}
