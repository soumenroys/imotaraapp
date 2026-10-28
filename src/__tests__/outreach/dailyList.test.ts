/**
 * 🔑 THE DAILY LIST — owner, 28 Oct 2026: "the daily broadcasted list will
 * also generated automatically … the daily calling list will also generated
 * automatically". Computed from the sheet by the same rules that send and call.
 */
import { describe, it, expect } from "vitest";
import { COLUMNS, STATUS, type Column, type Contact, type Directory } from "@/lib/voice/rules";
import { dailyList } from "@/lib/outreach/daily";
import type { OutreachState } from "@/lib/outreach/store";

const contact = (over: Partial<Record<Column, string>> = {}, row = 2): Contact => {
  const blank = Object.fromEntries(COLUMNS.map((c) => [c, ""])) as Record<Column, string>;
  return {
    tab: "NGOs", row,
    v: {
      ...blank, phone: `91983001234${row}`, name: `Person ${row}`, country: "IN", time_zone: "Asia/Kolkata", language: "bn", consent_note: "Seminar",
      status: "Pending", email: `p${row}@hope.org`,
      contact_by_email: "yes", mail_date: "2026-11-03", mail_time: "14:30",
      contact_by_phone: "yes", call_date: "2026-11-03", call_time: "11:00",
      ...over,
    },
  };
};
const dir = (contacts: Contact[]): Directory => ({
  contacts, languages: new Map([["bn", "start"]]), team: new Map(), dnc: new Set(),
  settings: { callingEnabled: true, autoDispatch: true, maxConcurrency: 2, dailyCap: 30, alertEmails: [] },
});
const state = (approved: boolean): OutreachState => ({
  settings: { enabled: true, sendWithoutAsking: false, dailyCap: 20 },
  drafts: approved ? { "ngos:intro": { subject: "s", body: "b", status: "approved", writtenAt: "", writtenBy: "x", findings: [] } } : {},
});
const none = new Set<string>();
const NOV_1 = new Date("2026-11-01T05:30:00Z");

describe("the day's lists", () => {
  it("list the email and the call set for that day, in time order", () => {
    const l = dailyList(dir([contact()]), none, state(true), "2026-11-03", NOV_1);
    expect(l.calls.map((x) => [x.what, x.status])).toEqual([["Call", "⏳ Scheduled"]]);
    expect(l.mail.map((x) => [x.what, x.status])).toEqual([["Introduction", "⏳ Scheduled"]]);
  });
  it("follow-ups appear on their own days, not the first", () => {
    expect(dailyList(dir([contact()]), none, state(true), "2026-11-10", NOV_1).mail.map((x) => x.what)).toEqual(["Follow-up (day 7)"]);
    expect(dailyList(dir([contact()]), none, state(true), "2026-11-24", NOV_1).mail.map((x) => x.what)).toEqual(["Last note (day 21)"]);
  });
  it("⛔ 'no' keeps a row off the lists entirely", () => {
    const l = dailyList(dir([contact({ contact_by_email: "no", contact_by_phone: "no" })]), none, state(true), "2026-11-03", NOV_1);
    expect(l.mail).toEqual([]);
    expect(l.calls).toEqual([]);
  });
  it("a due email waiting for approval says so", () => {
    const at3pm = new Date("2026-11-03T09:40:00Z");
    expect(dailyList(dir([contact()]), none, state(false), "2026-11-03", at3pm).mail[0].status).toMatch(/waiting for approval/);
  });
  it("what happened: sent, and called with the result", () => {
    const evening = new Date("2026-11-03T14:00:00Z");
    const done = contact({ mail_step: "1", mail_status: "In sequence", mail_last_sent: "2026-11-03T09:01:00Z", status: STATUS.interested, last_call_date: "2026-11-03T05:31:00Z", call_attempts: "1" });
    const l = dailyList(dir([done]), none, state(true), "2026-11-03", evening);
    expect(l.mail[0].status).toBe("✅ Sent 14:31 IST");
    expect(l.calls[0].status).toBe("📞 Called 11:01 IST — Interested");
  });
  it("today's unanswered calls show as retries", () => {
    const nov4 = new Date("2026-11-04T05:30:00Z");
    const c = contact({ status: STATUS.noAnswer, call_attempts: "1", last_call_date: "2026-11-03T05:31:00Z" });
    expect(dailyList(dir([c]), none, state(true), "2026-11-04", nov4).calls.map((x) => x.what)).toEqual(["Retry (try 2)"]);
  });
});
