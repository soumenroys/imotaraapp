// src/lib/social/platformTimes.ts
// Per-channel posting times, validated once.
//
// 🔑 THE OWNER, 18 Oct: "I want every social media schedule can be customized
// in different date and time."
//
// ⚠️ ONE VALIDATOR FOR BOTH ROUTES. Creating a schedule and editing one are
// different files with the same rules, and rules written twice drift — which
// on this surface would mean a time the create route accepts and the edit
// route rejects, or worse, the reverse.

import { PLATFORM_IDS } from "@/lib/social/platforms";

export type PlatformTimes = Record<string, { post_at?: string; days?: number[] }>;

/** ⚠️ `HH:MM`, the shape a person types and the shape both routes already
 *  demand of the schedule's own time. */
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export type TimesResult =
  | { ok: true; value: PlatformTimes | null }
  | { ok: false; error: string };

/**
 * Clean an incoming `platformTimes` object, or say exactly what is wrong.
 *
 * ⛔ REFUSES RATHER THAN DROPPING. A silently discarded entry means somebody
 * sets Instagram to 17:00, is told it saved, and finds out a day later that it
 * did not — the failure this whole feature is built to avoid.
 */
export function cleanPlatformTimes(input: unknown): TimesResult {
  if (input === null || input === undefined) return { ok: true, value: null };
  if (typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, error: "Per-channel times must be an object keyed by channel." };
  }

  const out: PlatformTimes = {};
  for (const [platform, raw] of Object.entries(input as Record<string, unknown>)) {
    if (!(PLATFORM_IDS as readonly string[]).includes(platform)) {
      return { ok: false, error: `"${platform}" is not a channel.` };
    }
    if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
      return { ok: false, error: `The entry for ${platform} is not an object.` };
    }
    const entry = raw as { post_at?: unknown; days?: unknown };
    const cleaned: { post_at?: string; days?: number[] } = {};

    if (entry.post_at !== undefined && entry.post_at !== "") {
      if (typeof entry.post_at !== "string" || !TIME.test(entry.post_at)) {
        return { ok: false, error: `The time for ${platform} must look like 17:00.` };
      }
      cleaned.post_at = entry.post_at;
    }
    if (entry.days !== undefined) {
      if (!Array.isArray(entry.days)) {
        return { ok: false, error: `The days for ${platform} must be a list.` };
      }
      const days = entry.days.filter((d) => Number.isInteger(d) && (d as number) >= 0 && (d as number) <= 6);
      if (days.length === 0) {
        return { ok: false, error: `Choose at least one day for ${platform}, or leave it unset to use the schedule's.` };
      }
      cleaned.days = days as number[];
    }

    // ⚠️ An empty entry is dropped, not stored. `{"instagram": {}}` would
    // read as an override and behave as none — a row that lies quietly.
    if (Object.keys(cleaned).length > 0) out[platform] = cleaned;
  }

  return { ok: true, value: Object.keys(out).length > 0 ? out : null };
}
