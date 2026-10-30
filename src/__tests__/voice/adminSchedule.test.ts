/**
 * 🔑 THE ADMIN'S OWN SCHEDULE — owner, 28 Oct 2026.
 *
 * The admin fills, per row: contact by email yes/no, contact by phone yes/no,
 * the first email's date + time + zone, and the call's date + time + zone.
 * Imotara then emails and calls by itself at exactly those times — "anytime in
 * 24 hours, 365 days … no restriction". Follow-up emails go 7 and 21 days
 * later at the same local time; unanswered calls are retried automatically;
 * a row with no date waits.
 */
import { describe, it, expect } from "vitest";
import { COLUMNS, STATUS, label, checkContact, selectDue, sheetCallDue, MISSED_SHEET_CALL, OUTSIDE_RETRY_HOURS, type Column, type Contact, type Directory } from "@/lib/voice/rules";
import { callSlot, localInstant, mailSlot, parseSheetDate, parseSheetTime, resolveZone, yes } from "@/lib/voice/slots";
import { progressFor } from "@/lib/outreach/progress";
import type { OutreachState } from "@/lib/outreach/store";

const contact = (over: Partial<Record<Column, string>> = {}, tab: Contact["tab"] = "NGOs", row = 2): Contact => {
  const blank = Object.fromEntries(COLUMNS.map((c) => [c, ""])) as Record<Column, string>;
  return {
    tab, row,
    v: {
      ...blank, phone: "919830012345", name: "Asha", organisation: "Hope", country: "IN", time_zone: "Asia/Kolkata", language: "bn",
      consent_note: "Seminar", status: "Pending", call_attempts: "0", email: "asha@hope.org",
      contact_by_phone: "yes", call_date: "2026-11-03", call_time: "11:00",
      contact_by_email: "yes", mail_date: "2026-11-03", mail_time: "14:30",
      ...over,
    },
  };
};
const dir = (contacts: Contact[], settings: Partial<Directory["settings"]> = {}): Directory => ({
  contacts,
  languages: new Map([["bn", "start"]]),
  team: new Map(),
  dnc: new Set(),
  settings: { callingEnabled: true, autoDispatch: true, maxConcurrency: 2, dailyCap: 30, alertEmails: [], allowIndividuals: false, ...settings },
});
const AT_11_IST_3_NOV = new Date("2026-11-03T05:30:00Z");
const MIN = 60_000;

describe("reading what the admin typed", () => {
  it("dates: the sheet's own format, and the Indian day-first way", () => {
    expect(parseSheetDate("2026-11-03")).toEqual({ y: 2026, m: 11, d: 3 });
    expect(parseSheetDate("03/11/2026")).toEqual({ y: 2026, m: 11, d: 3 }); // ⚠️ 3 November, not 11 March
    expect(parseSheetDate("3 Nov 2026")).toEqual({ y: 2026, m: 11, d: 3 });
    expect(parseSheetDate("Nov 3, 2026")).toEqual({ y: 2026, m: 11, d: 3 });
    expect(parseSheetDate("31/02/2026")).toBeNull();
    expect(parseSheetDate("next Tuesday")).toBeNull();
  });
  it("times: 24-hour and AM/PM; a bare number is refused", () => {
    expect(parseSheetTime("14:30")).toEqual({ h: 14, mi: 30 });
    expect(parseSheetTime("2:30 PM")).toEqual({ h: 14, mi: 30 });
    expect(parseSheetTime("12 am")).toEqual({ h: 0, mi: 0 });
    expect(parseSheetTime("03:00:00")).toEqual({ h: 3, mi: 0 });
    expect(parseSheetTime("9")).toBeNull();
    expect(parseSheetTime("25:00")).toBeNull();
  });
  it("zones: IANA names and the abbreviations the team types — IST is India", () => {
    expect(resolveZone("Asia/Kolkata")).toBe("Asia/Kolkata");
    expect(resolveZone("IST")).toBe("Asia/Kolkata");
    expect(resolveZone("Mars/Olympus")).toBeNull();
  });
  it("yes means yes; blank and no do not", () => {
    expect(yes("Yes")).toBe(true);
    expect(yes("")).toBe(false);
    expect(yes("no")).toBe(false);
  });
});

describe("turning it into a moment", () => {
  it("11:00 in Kolkata is 05:30 UTC", () => {
    const s = callSlot(contact());
    expect(s.kind === "at" && s.at.toISOString()).toBe("2026-11-03T05:30:00.000Z");
  });
  it("the call's own zone wins over the row's", () => {
    const s = callSlot(contact({ call_time_zone: "Europe/London" }));
    expect(s.kind === "at" && s.at.toISOString()).toBe("2026-11-03T11:00:00.000Z");
  });
  it("⚠️ across a daylight-saving change the wall clock is kept", () => {
    // London leaves BST on 25 Oct 2026: 09:00 on the 24th is 08:00 UTC, on the 26th 09:00 UTC.
    expect(localInstant({ y: 2026, m: 10, d: 24 }, { h: 9, mi: 0 }, "Europe/London").toISOString()).toBe("2026-10-24T08:00:00.000Z");
    expect(localInstant({ y: 2026, m: 10, d: 24 }, { h: 9, mi: 0 }, "Europe/London", 2).toISOString()).toBe("2026-10-26T09:00:00.000Z");
  });
  it("follow-ups are 7 and 21 days on, same local time", () => {
    const s = mailSlot(contact(), 21);
    expect(s.kind === "at" && s.at.toISOString()).toBe("2026-11-24T09:00:00.000Z");
  });
  it("a date it cannot read is a problem, with the words that were typed", () => {
    const s = callSlot(contact({ call_date: "tomorrow" }));
    expect(s).toEqual({ kind: "problem", problem: "Call date not understood (“tomorrow”)" });
  });
});

describe("calling at the admin's time", () => {
  it("rings at its time — with automatic calling OFF too, because the admin chose it", () => {
    const s = selectDue(dir([contact()], { autoDispatch: false }), AT_11_IST_3_NOV, { auto: false });
    expect(s.toCall).toHaveLength(1);
  });
  it("not a minute early", () => {
    expect(selectDue(dir([contact()]), new Date(AT_11_IST_3_NOV.getTime() - MIN), { auto: true }).toCall).toHaveLength(0);
  });
  it("⛔ contact_by_phone not yes ⇒ never called, even with a date", () => {
    expect(selectDue(dir([contact({ contact_by_phone: "no" })]), AT_11_IST_3_NOV, { auto: true }).toCall).toHaveLength(0);
    expect(checkContact(contact({ contact_by_phone: "" }), dir([]))).toBe("Contact by phone is not yes");
  });
  it("⛔ called once: the call it placed uses the slot up", () => {
    const placed = contact({ status: STATUS.interested, last_call_date: new Date(AT_11_IST_3_NOV.getTime() + 2 * MIN).toISOString() });
    expect(sheetCallDue(placed, new Date(AT_11_IST_3_NOV.getTime() + 30 * MIN))).toBe("none");
  });
  it("🔑 a new, LATER date calls again", () => {
    const before = contact({ status: STATUS.interested, last_call_date: "2026-10-20T05:30:00Z" });
    expect(sheetCallDue(before, AT_11_IST_3_NOV)).toBe("due");
  });
  it("⛔ over two hours late is missed, not called — and the sheet says so", () => {
    const late = new Date(AT_11_IST_3_NOV.getTime() + 3 * 60 * MIN);
    const s = selectDue(dir([contact()]), late, { auto: true });
    expect(s.toCall).toHaveLength(0);
    expect(s.skipped[0].reason).toBe(MISSED_SHEET_CALL);
  });
  it("⛔ a refused dial is not rung again every 5 minutes (the 24 Oct bug, through the new door)", () => {
    expect(selectDue(dir([contact({ status: STATUS.dialFailed })]), AT_11_IST_3_NOV, { auto: true }).toCall).toHaveLength(0);
  });
  it("a retry the system picks waits for the retry hours", () => {
    const missedAt3 = contact({ call_time: "03:00", status: STATUS.noAnswer, call_attempts: "1", last_call_date: "2026-11-02T21:31:00Z" });
    const at10pm = new Date("2026-11-04T16:30:00Z"); // 22:00 IST next day: spaced, a different part of the day, but past 21:00
    const s = selectDue(dir([missedAt3]), at10pm, { auto: true });
    expect(s.toCall).toHaveLength(0);
    expect(s.skipped[0].reason).toBe(OUTSIDE_RETRY_HOURS);
    // …and the same retry at 14:00 IST goes.
    expect(selectDue(dir([missedAt3]), new Date("2026-11-04T08:30:00Z"), { auto: true }).toCall).toHaveLength(1);
  });
});

describe("what the sheet tells the admin", () => {
  const state: OutreachState = { settings: { enabled: true, sendWithoutAsking: false, dailyCap: 20 }, drafts: {} };
  const d = dir([]);
  const before = new Date("2026-11-01T05:30:00Z");
  it("when the call and the first email are set for", () => {
    const p = progressFor(contact(), d, new Set(), state, before);
    expect(p.call_progress).toBe("⏳ Call set for 3 Nov, 11:00 (Asia/Kolkata)");
    expect(p.mail_progress).toBe("⏳ Introduction set for 3 Nov, 14:30 (Asia/Kolkata)");
  });
  it("a row with no date says to add one", () => {
    const p = progressFor(contact({ call_date: "", call_time: "", mail_date: "", mail_time: "" }), d, new Set(), state, before);
    expect(p.call_progress).toMatch(/add a call date and time/);
    expect(p.mail_progress).toMatch(/add a mail date and time/);
  });
  it("a date it cannot read names the fix", () => {
    const p = progressFor(contact({ call_date: "3rd Nov" }), d, new Set(), state, before);
    expect(p.call_progress).toMatch(/not understood/);
    expect(p.what_to_do).toMatch(/2026-11-03/);
  });
  it("a date set but 'no' chosen says how to switch it on", () => {
    const p = progressFor(contact({ contact_by_phone: "no" }), d, new Set(), state, before);
    expect(p.call_progress).toMatch(/Not chosen for a call/);
    expect(p.what_to_do).toContain(`Choose yes in “${label("contact_by_phone").replace(" (yes/no)", "")}”`);
  });
});
