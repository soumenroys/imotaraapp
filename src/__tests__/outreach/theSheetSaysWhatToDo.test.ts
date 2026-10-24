/**
 * 📋 THE SHEET SAYS WHAT TO DO — owner, 24 Oct 2026: mark what is done, not
 * done, in queue, errored, and how to fix it; lock everything but the admin's columns.
 */
import { describe, it, expect } from "vitest";
import { ADMIN_COLUMNS, COLUMNS, STATUS, checkContact, columnLetter, stoppedByAdmin, type Column, type Contact } from "@/lib/voice/rules";
import { MAIL, mailCheck, dueStep } from "@/lib/outreach/sequence";
import { progressFor } from "@/lib/outreach/progress";
import type { OutreachState } from "@/lib/outreach/store";

const contact = (over: Partial<Record<Column, string>> = {}): Contact => {
  const blank = Object.fromEntries(COLUMNS.map((c) => [c, ""])) as Record<Column, string>;
  return { tab: "NGOs", row: 2, v: { ...blank, phone: "919830012345", name: "Asha", organisation: "Hope", country: "IN", time_zone: "Asia/Kolkata", language: "bn", consent_note: "Seminar", status: "Pending", email: "asha@hope.org", ...over } };
};
const dir = { languages: new Map([["bn", "start"]]), dnc: new Set<string>(), settings: { callingEnabled: true, autoDispatch: false, maxConcurrency: 2, dailyCap: 30, alertEmails: [], allowIndividuals: false } };
const state: OutreachState = { settings: { enabled: true, sendWithoutAsking: false, dailyCap: 20 }, drafts: {} };
const none = new Set<string>();
const TUE_11_IST = new Date("2026-10-21T05:30:00Z");

describe("🔒 only the admin's columns are unlocked", () => {
  it("they are the columns a person types, and never a system one", () => {
    for (const c of ["status", "call_id", "mail_status", "call_progress", "what_to_do", "Check", "contact_number"] as Column[]) {
      expect(ADMIN_COLUMNS).not.toContain(c);
    }
    for (const c of ["phone", "name", "consent_note", "email", "do_not_contact"] as Column[]) expect(ADMIN_COLUMNS).toContain(c);
  });
  it("the new columns sit at AD–AG", () => {
    expect(columnLetter("do_not_contact")).toBe("AD");
    expect(columnLetter("what_to_do")).toBe("AG");
  });
});

describe("⛔ 'do not contact' stops both calls and email", () => {
  const c = contact({ do_not_contact: "yes" });
  it("is read from yes / stop / a tick", () => {
    expect(stoppedByAdmin(contact({ do_not_contact: "Yes" }))).toBe(true);
    expect(stoppedByAdmin(contact({ do_not_contact: "" }))).toBe(false);
  });
  it("calls refuse it", () => expect(checkContact(c, dir)).toMatch(/Stopped by admin/));
  it("email refuses it", () => expect(mailCheck(c, none)).toMatch(/Stopped by admin/));
});

describe("each row says where it stands and what to do", () => {
  it("✅ done, with nothing to do", () => {
    const p = progressFor(contact({ status: STATUS.notInterested }), dir, none, state, TUE_11_IST);
    expect(p.call_progress).toMatch(/^✅/);
  });
  it("⛔ a problem names its fix", () => {
    const p = progressFor(contact({ consent_note: "" }), dir, none, state, TUE_11_IST);
    expect(p.call_progress).toMatch(/^⛔/);
    expect(p.what_to_do).toMatch(/column J/);
  });
  it("🔴 safety is unmistakable", () => {
    expect(progressFor(contact({ status: STATUS.safety }), dir, none, state, TUE_11_IST).call_progress).toMatch(/^🔴 SAFETY/);
  });
  it("⏳ an email waiting for approval says so, and where to approve it", () => {
    const p = progressFor(contact(), dir, none, state, TUE_11_IST);
    expect(p.mail_progress).toMatch(/waiting for .* approved/);
    expect(p.what_to_do).toMatch(/Outreach mail → Emails/);
  });
  it("⛔ a dial failure explains how to retry", () => {
    const p = progressFor(contact({ status: STATUS.dialFailed, next_action: "Dial failed: 400" }), dir, none, state, TUE_11_IST);
    expect(p.what_to_do).toMatch(/Retry/);
  });
});

describe("a refused email is retried once the address is corrected", () => {
  it("same address ⇒ held; corrected ⇒ due again", () => {
    expect(mailCheck(contact({ mail_status: `${MAIL.failed}: asha@hope.org` }), none)).toMatch(/correct the email/);
    expect(dueStep(contact({ mail_status: `${MAIL.failed}: asha@old.org` }), none, TUE_11_IST)).toBe("intro");
  });
});
