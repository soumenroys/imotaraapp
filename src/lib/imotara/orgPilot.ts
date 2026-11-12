// src/lib/imotara/orgPilot.ts — #132 F part 2 (12 Nov 2026): the free NGO pilot.
//
// A pilot is an ordinary organisation with an END DATE. Nothing new is enforced here:
// resolve_user_tier already ignores an organisation once `expires_at` has passed
// (docs/sql/resolve_user_tier_canonical.sql — "o.expires_at is null or o.expires_at > now()"),
// so on day 31 every member falls back to their own plan by itself.
// This file only makes the two dates and the note the same every time. Pure — tested.

export const PILOT_DAYS = 30;

/** "YYYY-MM-DD" in UTC — what the admin form's <input type="date"> holds. */
function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Start = today, end = today + 30 days (the org is valid until that date). */
export function pilotWindow(now: Date = new Date(), days: number = PILOT_DAYS): { start: string; end: string } {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const end = new Date(start.getTime() + days * 86_400_000);
  return { start: ymd(start), end: ymd(end) };
}

/** The internal note written on the org, so anyone opening it later sees what it is. */
export function pilotNote(w: { start: string; end: string }): string {
  return `Free ${PILOT_DAYS}-day pilot · ${w.start} → ${w.end} · members return to their own plan after ${w.end}`;
}
