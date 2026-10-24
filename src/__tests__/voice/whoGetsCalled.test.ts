/**
 * 🔑 WHO GETS CALLED — the rules that decide whether a real phone rings.
 *
 * Every exclusion here is a promise to a person: they asked not to be called,
 * they never agreed to be, their language has not been checked by a native
 * speaker, or it is the middle of their night. Each one is pinned.
 */

import { describe, it, expect } from "vitest";
import {
  COLUMNS, STATUS, checkContact, selectDue, userData, writebackFor, helplineFor, normalisePhone,
  parseSettings, inCallingWindow, elevenLocal, columnLetter,
  type Contact, type Directory, type Column,
} from "@/lib/voice/rules";

const contact = (over: Partial<Record<Column, string>> = {}, tab: Contact["tab"] = "Individuals", row = 2): Contact => {
  const blank = Object.fromEntries(COLUMNS.map((c) => [c, ""])) as Record<Column, string>;
  return {
    tab,
    row,
    v: {
      ...blank,
      phone: "919830012345", name: "Asha", country: "IN", time_zone: "Asia/Kolkata", language: "bn",
      consent_note: "Seminar sign-up sheet, 12 Oct", status: "Pending", call_attempts: "0", team_member: "Tapan",
      ...over,
    },
  };
};

const dir = (contacts: Contact[], over: Partial<Directory> = {}): Directory => ({
  contacts,
  languages: new Map([["bn", "start"], ["hi", "start"], ["en", "start"], ["ta", "not_yet"]]),
  team: new Map([["tapan", "male"], ["suchismita", "female"]]),
  dnc: new Set(),
  settings: { callingEnabled: true, autoDispatch: true, maxConcurrency: 2, dailyCap: 30, alertEmails: [] },
  ...over,
});

// Tuesday 21 Oct 2026, 11:00 IST = 05:30 UTC
const TUE_11_IST = new Date("2026-10-21T05:30:00Z");

describe("the check", () => {
  it("a complete, consented contact in a started language is OK", () => {
    expect(checkContact(contact(), dir([]))).toBe("OK");
  });
  it("⛔ do-not-call wins over everything", () => {
    expect(checkContact(contact(), dir([], { dnc: new Set(["+919830012345"]) }))).toMatch(/do-not-call/);
  });
  it("⛔ no consent note, no call", () => {
    expect(checkContact(contact({ consent_note: "" }), dir([]))).toBe("Add consent note");
  });
  it("⛔ a language not yet approved by a native speaker is never called", () => {
    expect(checkContact(contact({ language: "ta" }), dir([]))).toBe("Language not started yet");
  });
  it("⛔ OpenLM is permanently excluded", () => {
    expect(checkContact(contact({ organisation: "OpenLM" }), dir([]))).toMatch(/OpenLM/);
  });
  it("the sample row is never called", () => {
    expect(checkContact(contact({ name: "SAMPLE - delete this row" }), dir([]))).toMatch(/Sample/);
  });
  it("a number without a country code is refused", () => {
    expect(checkContact(contact({ phone: "98300" }), dir([]))).toMatch(/country code/);
  });
});

describe("the calling window — their local time, not ours", () => {
  it("11:00 on a Tuesday in Kolkata is inside", () => {
    expect(inCallingWindow(TUE_11_IST, "Asia/Kolkata", "IN")).toBe(true);
  });
  it("the same instant is 01:30 in New York — outside", () => {
    expect(inCallingWindow(TUE_11_IST, "America/New_York", "US")).toBe(false);
  });
  it("⛔ never on a Sunday in India", () => {
    expect(inCallingWindow(new Date("2026-10-25T05:30:00Z"), "Asia/Kolkata", "IN")).toBe(false);
  });
  it("18:00 is already outside", () => {
    expect(inCallingWindow(new Date("2026-10-21T12:30:00Z"), "Asia/Kolkata", "IN")).toBe(false);
  });
});

describe("who is due", () => {
  it("⛔ with automatic calling OFF, only rows a person queued are called", () => {
    const d = dir([contact(), contact({ status: STATUS.queued }, "NGOs", 3)], {
      settings: { callingEnabled: true, autoDispatch: false, maxConcurrency: 2, dailyCap: 30, alertEmails: [] },
    });
    const s = selectDue(d, TUE_11_IST, { auto: false });
    expect(s.toCall.map((c) => c.tab)).toEqual(["NGOs"]);
  });

  it("never more than the free lines", () => {
    const many = [2, 3, 4, 5].map((r) => contact({ phone: `9198300000${r}0` }, "Individuals", r));
    const s = selectDue(dir(many), TUE_11_IST, { auto: true });
    expect(s.toCall).toHaveLength(2);
    expect(s.skipped.filter((x) => x.reason === "Waiting for a free line")).toHaveLength(2);
  });

  it("⛔ one number is never called twice at once, even from two tabs", () => {
    const s = selectDue(dir([contact({}, "Individuals", 2), contact({}, "NGOs", 2)]), TUE_11_IST, { auto: true });
    expect(s.toCall).toHaveLength(1);
    expect(s.skipped.some((x) => x.reason === "Already being called")).toBe(true);
  });

  it("organisations before individuals", () => {
    const s = selectDue(dir([contact({ phone: "919830011111" }), contact({ phone: "919830022222" }, "Education", 3)]), TUE_11_IST, { auto: true });
    expect(s.toCall[0].tab).toBe("Education");
  });

  it("a no-answer is retried only after 20 hours AND at a different part of the day", () => {
    const yesterdayMorning = new Date(TUE_11_IST.getTime() - 24 * 3600_000).toISOString();
    const sameTime = selectDue(dir([contact({ status: STATUS.noAnswer, call_attempts: "1", last_call_date: yesterdayMorning })]), TUE_11_IST, { auto: true });
    expect(sameTime.toCall).toHaveLength(0);
    const afternoon = new Date("2026-10-21T09:00:00Z"); // 14:30 IST
    const later = selectDue(dir([contact({ status: STATUS.noAnswer, call_attempts: "1", last_call_date: yesterdayMorning })]), afternoon, { auto: true });
    expect(later.toCall).toHaveLength(1);
  });

  it("⛔ never after three attempts", () => {
    const s = selectDue(dir([contact({ status: STATUS.noAnswer, call_attempts: "3", last_call_date: "2026-10-19T05:30:00Z" })]), new Date("2026-10-21T09:00:00Z"), { auto: true });
    expect(s.toCall).toHaveLength(0);
  });

  it("⛔ a safety follow-up is never auto-called", () => {
    const s = selectDue(dir([contact({ status: STATUS.safety })]), TUE_11_IST, { auto: true });
    expect(s.toCall).toHaveLength(0);
  });

  it("a live call holds its line", () => {
    const ringing = contact({ status: STATUS.calling, last_call_date: new Date(TUE_11_IST.getTime() - 5 * 60_000).toISOString() }, "NGOs", 9);
    const s = selectDue(dir([ringing, contact({ phone: "919830033333" }), contact({ phone: "919830044444" }, "Individuals", 3)]), TUE_11_IST, { auto: true });
    expect(s.activeCalls).toBe(1);
    expect(s.toCall).toHaveLength(1);
  });
});

describe("what the agent is told", () => {
  it("⛔ always discloses the virtual assistant, whatever the sheet says", () => {
    expect(userData(contact({ disclose_upfront: "no" }), dir([]), TUE_11_IST).disclose_upfront).toBe("yes");
  });
  it("India's helpline comes from the app's own crisis table", () => {
    expect(helplineFor("IN")).toBe("Tele-MANAS, 14416");
  });
  it("an unknown country gets no number to read — the agent points to local emergency services", () => {
    expect(helplineFor("XX")).toBe("");
  });
  it("the ambassador's gender comes from the Team tab", () => {
    expect(userData(contact({ team_member: "Suchismita" }), dir([]), TUE_11_IST).ambassador_gender).toBe("female");
  });
});

describe("what an outcome writes back", () => {
  it("⛔ safety: flagged, never auto-called again", () => {
    const w = writebackFor({ outcome: "safety" }, TUE_11_IST);
    expect(w.safety).toBe(true);
    expect(w.cells.status).toBe(STATUS.safety);
  });
  it("⛔ 'don't call again' goes to the do-not-call list", () => {
    expect(writebackFor({ outcome: "do_not_call" }, TUE_11_IST).addToDnc).toBe(true);
  });
  it("a callback with no time is tomorrow 11:00 in THEIR zone", () => {
    const w = writebackFor({ outcome: "callback_requested" }, TUE_11_IST, "Asia/Kolkata");
    expect(w.cells.follow_up_datetime).toBe("2026-10-22T05:30:00.000Z");
  });
  it("send-info is three days on, 11:00 local, and asks a person to send it", () => {
    const w = writebackFor({ outcome: "send_info" }, TUE_11_IST, "Asia/Kolkata");
    expect(w.cells.follow_up_datetime).toBe(elevenLocal(TUE_11_IST, 3, "Asia/Kolkata"));
    expect(w.sendInfo).toBe(true);
  });
  it("nothing extracted is treated as no answer, so it is retried", () => {
    expect(writebackFor({}, TUE_11_IST).cells.status).toBe(STATUS.noAnswer);
  });
});

describe("the sheet itself", () => {
  it("⛔ with no Settings tab, calling is OFF", () => {
    expect(parseSettings(null).callingEnabled).toBe(false);
    expect(parseSettings(null).autoDispatch).toBe(false);
  });
  it("Settings switch on only with an explicit yes", () => {
    expect(parseSettings([["calling_enabled", "yes"], ["auto_dispatch", "maybe"]])).toMatchObject({ callingEnabled: true, autoDispatch: false });
  });
  it("phone numbers normalise to +digits", () => {
    expect(normalisePhone("+91 98300-12345")).toBe("+919830012345");
  });
  it("the system column is Y", () => {
    expect(columnLetter("call_id")).toBe("Y");
    expect(columnLetter("status")).toBe("P");
  });
});
