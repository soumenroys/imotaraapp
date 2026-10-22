/**
 * 🔑 THE SHAPE BOLNA ACTUALLY SENDS — taken from the 21 Oct test call
 * (execution 26e4aaa6…), not from the docs alone. The first parser read
 * `extracted_data` as flat and came back with no outcome; a completed call
 * with no outcome was then written "No answer" and queued to ring again.
 */

import { describe, it, expect } from "vitest";
import { readExecution, flattenExtraction } from "@/lib/voice/bolna";
import { STATUS, selectDue, COLUMNS, type Column, type Contact, type Directory } from "@/lib/voice/rules";

const field = (objective: string | null, subjective: string | null) => ({
  objective, subjective, confidence: 0.9, confidence_label: "High",
  reasoning_objective: null, reasoning_subjective: null, validation: null,
});

const completed = (extracted: unknown) => ({
  id: "26e4aaa6-ddc8-4ff4-9623-b9868fc1db09",
  status: "completed",
  summary: "Bolna's own call summary.",
  extracted_data: extracted,
  context_details: { recipient_phone_number: "+919830012345", recipient_data: { imotara_tab: "Individuals", imotara_phone: "+919830012345" } },
});

describe("reading Bolna's result", () => {
  it("🔴 the outcome is found inside its category, in `objective`", () => {
    const v = readExecution(completed({ "Call Notes": { outcome: field("send_info", null), needs: field(null, "") } }));
    expect(v.extraction.outcome).toBe("send_info");
    expect(v.final).toBe(true);
  });

  it("a free-text field is read from `subjective`", () => {
    const x = flattenExtraction({ "Call Notes": { summary: field(null, "Soumen asked for the link.") } });
    expect(x.summary).toBe("Soumen asked for the link.");
  });

  it("the execution id is `id` and the row is found through recipient_data", () => {
    const v = readExecution(completed({ "Call Notes": { outcome: field("interested", null) } }));
    expect(v.executionId).toBe("26e4aaa6-ddc8-4ff4-9623-b9868fc1db09");
    expect([v.tab, v.phone]).toEqual(["Individuals", "+919830012345"]);
  });

  it("⛔ completed but no outcome YET is not final — it waits instead of becoming 'No answer'", () => {
    expect(readExecution(completed({})).final).toBe(false);
  });

  it("a no-answer needs no extraction to be final", () => {
    expect(readExecution({ id: "x", status: "no-answer", extracted_data: {} }).final).toBe(true);
  });

  it("a flat shape still works", () => {
    expect(flattenExtraction({ outcome: "meeting_booked" }).outcome).toBe("meeting_booked");
  });
});

describe("⛔ 'Needs review' is never rung automatically", () => {
  it("is skipped even with automatic calling on", () => {
    const blank = Object.fromEntries(COLUMNS.map((c) => [c, ""])) as Record<Column, string>;
    const c: Contact = { tab: "Individuals", row: 2, v: { ...blank, phone: "919830012345", name: "Asha", country: "IN", time_zone: "Asia/Kolkata", language: "bn", consent_note: "seminar", status: STATUS.review, call_attempts: "1" } };
    const d: Directory = {
      contacts: [c], languages: new Map([["bn", "start"]]), team: new Map(), dnc: new Set(),
      settings: { callingEnabled: true, autoDispatch: true, maxConcurrency: 2, dailyCap: 30, alertEmails: [] },
    };
    expect(selectDue(d, new Date("2026-10-21T05:30:00Z"), { auto: true }).toCall).toHaveLength(0);
  });
});
