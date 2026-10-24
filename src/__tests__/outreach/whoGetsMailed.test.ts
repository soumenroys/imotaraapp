/**
 * ✉️ WHO GETS MAILED — the rules that decide whether an outreach email goes out.
 *
 * Owner's design, 24 Oct 2026: one sheet row is one person for calls and mail;
 * consent note required; intro, day 7, day 21; a call asking for details sends
 * the info email; unsubscribe, bounce, a "no" on a call or a meeting stops it.
 */
import { describe, it, expect } from "vitest";
import { COLUMNS, STATUS, columnLetter, letterFor, phoneOf, writebackFor, type Column, type Contact } from "@/lib/voice/rules";
import { MAIL, afterSent, dueStep, mailCheck, selectMail } from "@/lib/outreach/sequence";
import { checkMailStyle, SIGNATURE, parseMail } from "@/lib/outreach/writer";
import { buildMessage, OUTREACH_ID } from "@/lib/outreach/send";
import { sendableDraft, type OutreachState } from "@/lib/outreach/store";

const contact = (over: Partial<Record<Column, string>> = {}, tab: Contact["tab"] = "NGOs", row = 2): Contact => {
  const blank = Object.fromEntries(COLUMNS.map((c) => [c, ""])) as Record<Column, string>;
  return {
    tab, row,
    v: {
      ...blank, phone: "919830012345", name: "Asha", organisation: "Hope Trust", country: "IN", time_zone: "Asia/Kolkata",
      language: "en", consent_note: "Asked for details at the 12 Oct seminar", status: "Pending", email: "asha@hope.org",
      ...over,
    },
  };
};
const none = new Set<string>();
// Tuesday 21 Oct 2026, 11:00 IST
const TUE_11_IST = new Date("2026-10-21T05:30:00Z");
const DAY = 86_400_000;

describe("the sheet's columns past Z", () => {
  it("letters run Z, AA, AB, AC", () => {
    expect(letterFor(25)).toBe("Z");
    expect(letterFor(26)).toBe("AA");
    expect(columnLetter("email")).toBe("Z");
    expect(columnLetter("mail_last_sent")).toBe("AC");
    expect(columnLetter("call_id")).toBe("Y");
  });
});

describe("who may be emailed", () => {
  it("a consented contact with an email is OK", () => {
    expect(mailCheck(contact(), none)).toBe("OK");
  });
  it("⛔ no consent note, no email — the owner's rule", () => {
    expect(mailCheck(contact({ consent_note: "" }), none)).toBe("Add consent note");
  });
  it("⛔ unsubscribed or bounced addresses are never emailed", () => {
    expect(mailCheck(contact(), new Set(["asha@hope.org"]))).toMatch(/never email/);
  });
  it("⛔ a call that said no stops every email", () => {
    for (const s of [STATUS.notInterested, STATUS.dnc, STATUS.wrongNumber, STATUS.safety, STATUS.meeting]) {
      expect(mailCheck(contact({ status: s }), none)).toMatch(/Call outcome/);
    }
  });
  it("a malformed address is caught", () => {
    expect(mailCheck(contact({ email: "asha@hope" }), none)).toBe("Email looks wrong");
  });
});

describe("the sequence: day 0, 7, 21", () => {
  it("the introduction goes first, in their daytime", () => {
    expect(dueStep(contact(), none, TUE_11_IST)).toBe("intro");
  });
  it("⛔ never at night their time", () => {
    expect(dueStep(contact(), none, new Date("2026-10-21T17:30:00Z"))).toBeNull(); // 23:00 IST
  });
  it("the follow-up waits seven days", () => {
    const sentAt = new Date(TUE_11_IST.getTime() - 6 * DAY).toISOString();
    expect(dueStep(contact({ mail_step: "1", mail_last_sent: sentAt }), none, TUE_11_IST)).toBeNull();
    const weekAgo = new Date(TUE_11_IST.getTime() - 7 * DAY).toISOString();
    expect(dueStep(contact({ mail_step: "1", mail_last_sent: weekAgo }), none, TUE_11_IST)).toBe("followup");
  });
  it("the last note is fourteen days after the follow-up", () => {
    const at = new Date(TUE_11_IST.getTime() - 14 * DAY).toISOString();
    expect(dueStep(contact({ mail_step: "2", mail_last_sent: at }), none, TUE_11_IST)).toBe("last");
  });
  it("after three emails, nothing more", () => {
    const c = contact({ mail_step: "2", mail_last_sent: new Date(0).toISOString() });
    const w = afterSent(c, "last", TUE_11_IST);
    expect(w.mail_status).toBe(MAIL.done);
    expect(dueStep(contact({ ...w, mail_step: "3" }), none, TUE_11_IST)).toBeNull();
  });
  it("🔑 a call that ended 'send me details' sends the info email next", () => {
    const w = writebackFor({ outcome: "send_info" }, TUE_11_IST);
    expect(w.cells.mail_status).toBe(MAIL.infoDue);
    expect(dueStep(contact({ mail_status: MAIL.infoDue }), none, TUE_11_IST)).toBe("info");
    expect(afterSent(contact(), "info", TUE_11_IST).mail_status).toBe(MAIL.infoSent);
  });
  it("⛔ one email per address per run, even on two tabs", () => {
    const picks = selectMail([contact({}, "NGOs", 2), contact({}, "Education", 2)], none, TUE_11_IST, 10);
    expect(picks).toHaveLength(1);
  });
});

describe("⛔ only an approved draft is sent", () => {
  const draft = { subject: "s", body: "b", writtenAt: "", findings: [] as string[] };
  const state = (status: "needs_review" | "approved", sendWithoutAsking = false, findings: string[] = [], writtenBy = "automatic"): OutreachState => ({
    settings: { enabled: true, sendWithoutAsking, dailyCap: 20 },
    drafts: { "ngos:intro": { ...draft, writtenBy, status, findings } },
  });
  it("waiting for review ⇒ not sent", () => expect(sendableDraft(state("needs_review"), "ngos", "intro")).toBeNull());
  it("approved ⇒ sent", () => expect(sendableDraft(state("approved"), "ngos", "intro")).not.toBeNull());
  it("send-without-asking sends a CLEAN unreviewed draft", () => expect(sendableDraft(state("needs_review", true), "ngos", "intro")).not.toBeNull());
  it("⛔ …but never one with findings", () => expect(sendableDraft(state("needs_review", true, ["x"]), "ngos", "intro")).toBeNull());
  it("⛔ …and never one a person edited and left unapproved", () => expect(sendableDraft(state("needs_review", true, [], "owner@x"), "ngos", "intro")).toBeNull());
});

describe("the house style is checked in code", () => {
  const good = `Hello {{name|there}},\n\nA plain note.\n\nhttps://www.imotara.com\n\nWould a one-page summary help?\n\n${SIGNATURE}`;
  it("a letter that follows the rules passes", () => expect(checkMailStyle("A question about your team", good)).toEqual([]));
  it("⛔ campaign furniture is refused", () => {
    expect(checkMailStyle("Act now!", good).join(" ")).toMatch(/exclamation/);
    expect(checkMailStyle("Hi", good.replace("A plain note.", "Limited time discount.")).join(" ")).toMatch(/Promotional/);
    expect(checkMailStyle("Hi", good + "\nhttps://example.com").join(" ")).toMatch(/one link/);
    expect(checkMailStyle("Hi", good.replace("{{name|there}}", "{{name}}")).join(" ")).toMatch(/greet by name/);
    expect(checkMailStyle("Hi", good.replace("Would a one-page summary help?", "Thanks.")).join(" ")).toMatch(/asking/);
  });
  it("the writer's JSON is read even with words around it", () => {
    expect(parseMail('Sure: {"subject":"S","body":"B"} done')).toEqual({ subject: "S", body: "B" });
  });
});

describe("the email that is actually sent", () => {
  const m = buildMessage(
    { subject: "About {{organisation}}", body: "Hello {{name|there}},\n\nFor {{organisation}}.\n\nAny questions?" },
    { email: "asha@hope.org", name: "Asha", organisation: "Hope Trust" },
    { name: "Imotara", email: "info@imotara.com" },
  );
  it("is personalised", () => {
    expect(m.subject).toBe("About Hope Trust");
    expect(m.text).toContain("Hello Asha,");
    expect(m.text).toContain("For Hope Trust.");
  });
  it("⛔ always carries one-click unsubscribe, recorded against outreach's own id", () => {
    process.env.BROADCAST_UNSUBSCRIBE_SECRET ||= "test-secret";
    expect(OUTREACH_ID).toMatch(/^[0-9a-f-]{36}$/);
    expect(m.html.toLowerCase()).toContain("unsubscribe");
  });
});

describe("spam-safe wording is matched as whole words", () => {
  const ok = `Hello {{name|there}},\n\nStudents learn a lot; an ideal space.\n\nWould that help?\n\n${SIGNATURE}`;
  it("'learn' and 'ideal' are not flagged", () => expect(checkMailStyle("A note for your team", ok)).toEqual([]));
  it("⛔ 'free' in a subject and shouting are flagged", () => {
    expect(checkMailStyle("Free for your staff", ok).join(" ")).toMatch(/free/i);
    expect(checkMailStyle("A note", ok.replace("Students", "STUDENTS")).join(" ")).toMatch(/SHOUTED/);
  });
});

describe("⛔ the Do-not-call tab stops email too", () => {
  it("a phone on the Do-not-call list is never emailed", () => {
    const c = contact();
    expect(mailCheck(c, none)).toBe("OK");
    expect(mailCheck(c, none, new Set([phoneOf(c)]))).toMatch(/do-not-call/);
    expect(dueStep(c, none, TUE_11_IST, new Set([phoneOf(c)]))).toBeNull();
  });
});
