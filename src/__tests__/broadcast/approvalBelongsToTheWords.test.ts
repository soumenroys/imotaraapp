/**
 * ✅ A BROADCAST IS APPROVED BEFORE IT GOES — and the approval belongs to the words.
 * Owner, 24 Oct 2026: approval like the social scheduler, then into the scheduler.
 */
import { describe, it, expect } from "vitest";
import { approvalBlocker, approvalState, contentHash, type Approval } from "@/lib/broadcast/approval";
import { sourceFor, OUTREACH_PREFIX, listNameFor } from "@/lib/outreach/record";
import { buildMessage } from "@/lib/outreach/send";

const b = { subject: "Hello", body_html: "<p>Hi</p>", body_text: "Hi", header_text: "", list_id: "L1", from_email: "a@imotara.com", message_type: "broadcast" };
const approved = (x = b): Record<string, Approval> => ({ id1: { approvedBy: "o", approvedAt: "t", hash: contentHash(x) } });

describe("the approval", () => {
  it("nothing approved ⇒ it cannot go", () => {
    expect(approvalState({}, "id1", b)).toBe("none");
    expect(approvalBlocker("none")).toMatch(/Not approved/);
  });
  it("approved as it stands ⇒ it can go", () => {
    expect(approvalState(approved(), "id1", b)).toBe("approved");
    expect(approvalBlocker("approved")).toBeNull();
  });
  it("⛔ any later edit — subject, body, list or sender — asks for approval again", () => {
    for (const change of [{ subject: "Hello!" }, { body_html: "<p>Hey</p>" }, { list_id: "L2" }, { from_email: "b@imotara.com" }]) {
      expect(approvalState(approved(), "id1", { ...b, ...change })).toBe("changed");
    }
    expect(approvalBlocker("changed")).toMatch(/approve it again/);
  });
});

describe("outreach on the Broadcast screens", () => {
  it("each audience has its own recipient list", () => expect(listNameFor("ngos")).toBe("Outreach — NGOs"));
  it("history marks outreach rows by their prefix", () => expect(OUTREACH_PREFIX).toBe("Outreach · "));
  it("provenance is read honestly from the sheet, defaulting to a meeting", () => {
    expect(sourceFor("Seminar · asked at the 12 Oct session")).toBe("event");
    expect(sourceFor("WhatsApp group")).toBe("whatsapp");
    expect(sourceFor("website form")).toBe("website_form");
    expect(sourceFor("met at their office")).toBe("meeting");
  });
  it("the unsubscribe link is bound to the version that was sent", () => {
    const id = "11111111-2222-4333-8444-555555555555";
    const m = buildMessage({ subject: "S", body: "Hello {{name|there}},\n\nAny questions?" }, { email: "x@y.org", name: "", organisation: "" },
      { name: "Imotara", email: "info@imotara.com" }, id);
    expect(m.text).toContain(Buffer.from(`x@y.org:${id}`).toString("base64url"));
  });
});
