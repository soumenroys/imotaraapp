// src/lib/voice/slots.ts
// The admin's own schedule, read from the sheet: yes/no per channel, and a
// date + time + time zone for the first email and for the call.
//
// 🔑 OWNER, 28 Oct 2026: "admin job will be to fillup the google sheet with
// broadcasting date and time for each row and the broadcasting schedule will
// set up automatically". And: "that can be anytime in 24 hours, 365 days,
// based on the timezone, no restriction" ⇒ an admin's time is honoured as
// typed — no calling hours, no Sunday rule. Only RETRIES, whose time the
// system picks, keep a daytime band ⇒ rules.inRetryHours.
//
// ⚠️ PURE: no clock, no network ⇒ src/__tests__/voice/adminSchedule.test.ts.

import type { Contact } from "@/lib/voice/rules";

/** "yes", "y", "true", "1" or a ticked box. ⛔ Blank is NOT yes: nobody is contacted on a channel the admin did not choose. */
export function yes(s: string | undefined): boolean {
  return /^(yes|y|true|1|✓|✔)$/i.test((s ?? "").trim());
}

/** Common abbreviations the team may type instead of an IANA name. ⚠️ IST is India here, never Israel or Ireland. */
const ZONE_ALIASES: Record<string, string> = {
  ist: "Asia/Kolkata", india: "Asia/Kolkata", kolkata: "Asia/Kolkata", calcutta: "Asia/Kolkata",
  utc: "UTC", gmt: "UTC", bst: "Europe/London", uk: "Europe/London", london: "Europe/London",
  cet: "Europe/Berlin", cest: "Europe/Berlin",
  est: "America/New_York", edt: "America/New_York", et: "America/New_York",
  cst: "America/Chicago", cdt: "America/Chicago", mst: "America/Denver", mdt: "America/Denver",
  pst: "America/Los_Angeles", pdt: "America/Los_Angeles", pt: "America/Los_Angeles",
  aest: "Australia/Sydney", aedt: "Australia/Sydney", sgt: "Asia/Singapore", gst: "Asia/Dubai",
  pkt: "Asia/Karachi", npt: "Asia/Kathmandu", bdt: "Asia/Dhaka", jst: "Asia/Tokyo",
};

/** An IANA zone name, or null when it cannot be used. */
export function resolveZone(raw: string | undefined): string | null {
  const s = (raw ?? "").trim();
  if (!s) return null;
  const zone = ZONE_ALIASES[s.toLowerCase()] ?? s;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: zone });
    return zone;
  } catch {
    return null;
  }
}

type Ymd = { y: number; m: number; d: number };
type Hm = { h: number; mi: number };

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

function valid(y: number, m: number, d: number): Ymd | null {
  if (!(y >= 2000 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31)) return null;
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCMonth() === m - 1 ? { y, m, d } : null;
}

/**
 * A date as the sheet shows it. The columns are formatted yyyy-mm-dd, but a
 * pasted value may arrive another way. ⚠️ 03/11/2026 is read DAY first — the
 * team writes dates the Indian way; a month-first date would be a wrong day.
 */
export function parseSheetDate(raw: string | undefined): Ymd | null {
  const s = (raw ?? "").trim();
  let m: RegExpMatchArray | null;
  if ((m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/))) return valid(+m[1], +m[2], +m[3]);
  if ((m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/))) return valid(+m[3], +m[2], +m[1]);
  if ((m = s.match(/^(\d{1,2})[-\s]([a-z]{3})[a-z]*[-\s,]+(\d{4})$/i))) {
    const mo = MONTHS.indexOf(m[2].toLowerCase());
    return mo < 0 ? null : valid(+m[3], mo + 1, +m[1]);
  }
  if ((m = s.match(/^([a-z]{3})[a-z]*\s+(\d{1,2}),?\s+(\d{4})$/i))) {
    const mo = MONTHS.indexOf(m[1].toLowerCase());
    return mo < 0 ? null : valid(+m[3], mo + 1, +m[2]);
  }
  return null;
}

/** "14:30", "14:30:00", "2:30 PM", "2 pm", "9.15". */
export function parseSheetTime(raw: string | undefined): Hm | null {
  const s = (raw ?? "").trim().toLowerCase();
  const m = s.match(/^(\d{1,2})(?:[:.](\d{2}))?(?::\d{2})?\s*(am|pm|a\.m\.|p\.m\.)?$/);
  if (!m) return null;
  let h = Number(m[1]);
  const mi = Number(m[2] ?? 0);
  const ap = m[3]?.replace(/\./g, "");
  if (ap) {
    if (h < 1 || h > 12) return null;
    if (ap === "am" && h === 12) h = 0;
    if (ap === "pm" && h !== 12) h += 12;
  } else if (m[2] === undefined) {
    return null; // a bare "9" is not a time anybody can be sure of
  }
  return h <= 23 && mi <= 59 ? { h, mi } : null;
}

/** Minutes the zone is ahead of UTC at `at` (e.g. +330 for Asia/Kolkata). */
export function zoneOffsetMinutes(at: Date, timeZone: string): number {
  const p = new Intl.DateTimeFormat("en-US", {
    timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(at);
  const g = (t: string) => Number(p.find((x) => x.type === t)?.value);
  const asUtc = Date.UTC(g("year"), g("month") - 1, g("day"), g("hour"), g("minute"), g("second"));
  return Math.round((asUtc - at.getTime()) / 60_000);
}

/**
 * That wall-clock time in that zone, `addDays` later, as an instant.
 * ⚠️ The offset is taken twice: once at a guess, once at the answer — so a
 * time on the far side of a daylight-saving change still lands right.
 */
export function localInstant(date: Ymd, time: Hm, timeZone: string, addDays = 0): Date {
  const wall = Date.UTC(date.y, date.m - 1, date.d + addDays, time.h, time.mi, 0);
  const first = wall - zoneOffsetMinutes(new Date(wall), timeZone) * 60_000;
  return new Date(wall - zoneOffsetMinutes(new Date(first), timeZone) * 60_000);
}

export type Slot =
  | { kind: "none" }
  | { kind: "problem"; problem: string }
  | { kind: "at"; at: Date; zone: string };

function slot(dateRaw: string, timeRaw: string, zoneRaw: string, fallbackZone: string, what: string, addDays = 0): Slot {
  if (!dateRaw.trim() && !timeRaw.trim()) return { kind: "none" };
  const date = parseSheetDate(dateRaw);
  if (!date) return { kind: "problem", problem: dateRaw.trim() ? `${what} date not understood (“${dateRaw.trim()}”)` : `Add a ${what.toLowerCase()} date` };
  const time = parseSheetTime(timeRaw);
  if (!time) return { kind: "problem", problem: timeRaw.trim() ? `${what} time not understood (“${timeRaw.trim()}”)` : `Add a ${what.toLowerCase()} time` };
  const zone = resolveZone(zoneRaw || fallbackZone);
  if (!zone) return { kind: "problem", problem: (zoneRaw || fallbackZone).trim() ? `${what} time zone not understood (“${(zoneRaw || fallbackZone).trim()}”)` : `Add a ${what.toLowerCase()} time zone` };
  return { kind: "at", at: localInstant(date, time, zone, addDays), zone };
}

/** The zone a call is placed in: its own column, else the row's time_zone. */
export const callZone = (c: Contact) => resolveZone(c.v.call_time_zone || c.v.time_zone);
export const mailZone = (c: Contact) => resolveZone(c.v.mail_time_zone || c.v.time_zone);

/** When the admin wants this person called, from call_date + call_time + call_time_zone. */
export function callSlot(c: Contact): Slot {
  return slot(c.v.call_date, c.v.call_time, c.v.call_time_zone, c.v.time_zone, "Call");
}

/** When the email `afterDays` into the sequence is due: the admin's first-email time, that many days later, same local time. */
export function mailSlot(c: Contact, afterDays = 0): Slot {
  return slot(c.v.mail_date, c.v.mail_time, c.v.mail_time_zone, c.v.time_zone, "Mail", afterDays);
}

/** "3 Nov, 11:00" in that zone — how a slot is shown back to the admin. */
export function showSlot(at: Date, zone: string): string {
  const s = at.toLocaleString("en-GB", { timeZone: zone, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  return `${s} (${zone})`;
}
