// src/lib/meetings/plan.ts
// Which agreed meetings go into the Imotara calendar, and what each event says.
//
// 🔑 OWNER, 31 Oct 2026 (corrected): "if users agreed to meet imotara
// representative on a specific date and time, then the meeting need to be
// scheduled in imotara.imotara@gmail.com calendar and tapan and suchismita need
// to be added there. the meeting schedule should be as per the user requested
// date and time with that user location timezone." And 1 Nov 2026: the user is
// invited too.
//
// ⛔ Nothing more than that: no other slots proposed, no video link, no approval
// step — the owner removed those extras from the first version.
//
// ⚠️ PURE: no network, no clock of its own ⇒ src/__tests__/meetings.

import { createHash } from "node:crypto";
import { stoppedByAdmin, type Contact } from "@/lib/voice/rules";
import { meetingSlot } from "@/lib/voice/slots";

/** The team members every meeting invites (owner, 1 Nov 2026). */
export const MEETING_TEAM = ["tapan@imotara.com", "suchismita.sen@imotara.com"] as const;

/** The calendar the events live in. ⛔ A grant for any other account is refused. */
export const MEETING_CALENDAR_ACCOUNT = "imotara.imotara@gmail.com";

/** How long the calendar blocks. Nobody agreed a length; half an hour is a placeholder the team can stretch. */
export const MEETING_MINUTES = 30;

/** "✅ Booked …" in the sheet ⇒ in the calendar. Anything else (empty, ⛔ …) ⇒ not yet. */
export const BOOKED_MARK = "✅ Booked";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type CalendarEvent = {
  id: string;
  summary: string;
  description: string;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  attendees: { email: string }[];
};

export type MeetingWork =
  /** Not in the calendar yet ⇒ insert (a 409 means it is, from an earlier run whose sheet write was lost ⇒ update). */
  | { kind: "book"; c: Contact; event: CalendarEvent; mark: string }
  /** In the calendar at another time, or with another guest ⇒ update the same event; the guests get the change. */
  | { kind: "update"; c: Contact; event: CalendarEvent; mark: string }
  /** Cannot be booked as the row stands ⇒ say why in the sheet, once. */
  | { kind: "problem"; c: Contact; mark: string };

/**
 * 🔑 ONE EVENT PER PERSON, ever. The id is derived from who the row is, so a
 * retry — or a changed time — reaches the SAME event instead of a second one.
 * Calendar ids take a–v and 0–9 only ⇒ a hex digest fits.
 * ⚠️ Not from the row number alone: a cleared row typed over with a new person
 * must not inherit the last person's meeting. Nor from the email: adding it
 * after booking must update the event, not orphan it beside a new one.
 */
export function meetingEventId(c: Contact): string {
  const person = String(c.v.phone ?? "").replace(/[^0-9]/g, "") || String(c.v.name ?? "").trim().toLowerCase();
  const who = [c.tab, c.row, person].join("|");
  return `imotara${createHash("sha256").update(who).digest("hex").slice(0, 40)}`;
}

/** What the sheet shows once booked — also the fingerprint of WHAT was booked, so a change is noticed. */
export function bookedMark(local: string, zone: string, guest: string | null): string {
  return `${BOOKED_MARK} ${local} ${zone}${guest ? ` · ${guest} invited` : " · ⚠️ no email for them — add it and they are invited"}`;
}

/** "2026-11-04 15:00" in that zone. */
function localLabel(at: Date, zone: string): string {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: zone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(at);
  const g = (t: string) => p.find((x) => x.type === t)?.value ?? "";
  return `${g("year")}-${g("month")}-${g("day")} ${g("hour")}:${g("minute")}`;
}

/**
 * 🔴 THE PERSON SEES THIS EVENT — they are a guest. So it carries only what
 * they already know: who they are meeting and the website. ⛔ Never the team's
 * notes, the consent note, the call summary or their phone number.
 */
export function meetingEvent(c: Contact, at: Date, zone: string, guest: string | null): CalendarEvent {
  const who = c.v.organisation?.trim() || c.v.name?.trim() || "a new contact";
  const end = new Date(at.getTime() + MEETING_MINUTES * 60_000);
  return {
    id: meetingEventId(c),
    summary: `Imotara × ${who}`,
    description: "A meeting with the Imotara team, at the date and time you agreed.\n\nImotara: https://www.imotara.com",
    start: { dateTime: at.toISOString(), timeZone: zone },
    end: { dateTime: end.toISOString(), timeZone: zone },
    attendees: [...MEETING_TEAM, ...(guest ? [guest] : [])].map((email) => ({ email })),
  };
}

/**
 * The work for this run. A row is looked at only when it has a meeting date or
 * time; everything else is left exactly as it is.
 */
export function meetingWork(contacts: readonly Contact[], now: Date): MeetingWork[] {
  const out: MeetingWork[] = [];
  for (const c of contacts) {
    const slot = meetingSlot(c);
    if (slot.kind === "none") continue;
    const current = (c.v.meeting_booked ?? "").trim();
    const booked = current.startsWith(BOOKED_MARK);
    const problem = (mark: string) => {
      if (current !== mark) out.push({ kind: "problem", c, mark });
    };

    if (stoppedByAdmin(c)) {
      // ⚠️ A booked meeting stays booked: cancelling one is a person's call, not a side effect of a stop.
      if (!booked) problem("⛔ Not booked — 'Stop all contact?' is yes");
      continue;
    }
    if (slot.kind === "problem") {
      if (!booked) problem(`⛔ Not booked — ${slot.problem}`);
      continue;
    }

    const email = (c.v.email ?? "").trim();
    const guest = EMAIL.test(email) ? email.toLowerCase() : null;
    const local = localLabel(slot.at, slot.zone);
    const mark = bookedMark(local, slot.zone, guest);
    if (current === mark) continue;

    // ⛔ A time already gone is not booked: an invitation for the past helps nobody.
    // A booked one that moved into the past is left alone for the same reason.
    if (slot.at.getTime() <= now.getTime()) {
      if (!booked) problem(`⛔ Not booked — ${local} ${slot.zone} has already passed`);
      continue;
    }
    const event = meetingEvent(c, slot.at, slot.zone, guest);
    out.push(booked ? { kind: "update", c, event, mark } : { kind: "book", c, event, mark });
  }
  return out;
}
