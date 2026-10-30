// src/__tests__/voice/pickedUpIsNotNoAnswer.test.ts
// 🔴 30 Oct 2026: Saswati picked up twice — once for 84 s, once for 10 s — and
// both calls were written "No answer": the call summary guessed no_answer for a
// call that broke off. The call service had said "completed" (= someone picked
// up). ⇒ a picked-up call that came to nothing says so, and is never retried by
// a machine; a person decides.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { COLUMNS, NEEDS_A_PERSON, NO_MORE_CALLS, STATUS, selectDue, writebackFor, type Column, type Contact, type Directory } from "@/lib/voice/rules";
import { progressFor } from "@/lib/outreach/progress";

const NOW = new Date("2026-10-30T06:00:00Z");

describe("🔑 completed + no outcome ⇒ 'Picked up, call ended early'", () => {
  it.each([["no_answer"], [""], [undefined]])("outcome %s on an ANSWERED call", (outcome) => {
    const w = writebackFor({ outcome: outcome as string | undefined }, NOW, "Asia/Kolkata", true);
    expect(w.cells.status).toBe(STATUS.brokeOff);
    expect(w.cells.next_action).toMatch(/answered, but the call ended early/);
  });
  it("a phone that rang out stays 'No answer' (retried as before)", () => {
    expect(writebackFor({ outcome: "no_answer" }, NOW, "Asia/Kolkata", false).cells.status).toBe(STATUS.noAnswer);
  });
  it("voicemail stays 'No answer' even though the line connected", () => {
    expect(writebackFor({ outcome: "voicemail" }, NOW, "Asia/Kolkata", true).cells.status).toBe(STATUS.noAnswer);
  });
  it("a real outcome still wins", () => {
    expect(writebackFor({ outcome: "not_interested" }, NOW, "Asia/Kolkata", true).cells.status).toBe(STATUS.notInterested);
    expect(writebackFor({ outcome: "safety" }, NOW, "Asia/Kolkata", true).cells.status).toBe(STATUS.safety);
  });
  it("the call result is read as 'answered' from the call service's own status", () => {
    const src = readFileSync(join(process.cwd(), "src/lib/voice/dispatch.ts"), "utf8");
    expect(src).toMatch(/writebackFor\(extraction, now, [^)]*v\.status === "completed"\)/);
  });
});

describe("⛔ never rung again by a machine — a person decides", () => {
  const blank = Object.fromEntries(COLUMNS.map((c) => [c, ""])) as Record<Column, string>;
  const c: Contact = {
    tab: "NGOs", row: 2,
    v: { ...blank, phone: "+918910251612", name: "Saswati", country: "IN", time_zone: "Asia/Kolkata", language: "bn", consent_note: "agreed", contact_by_phone: "yes", status: STATUS.brokeOff, call_attempts: "1", last_call_date: "2026-10-29T07:30:00Z" },
  };
  const dir: Directory = {
    contacts: [c], languages: new Map([["bn", "start"]]), team: new Map(), dnc: new Set(),
    settings: { callingEnabled: true, autoDispatch: true, maxConcurrency: 2, dailyCap: 30, alertEmails: [], allowIndividuals: true },
  };
  it("automatic dispatch does not pick it", () => expect(selectDue(dir, NOW, { auto: true }).toCall).toEqual([]));
  it("it is listed for a person, and Call now still works (not a 'no more calls' status)", () => {
    expect(NEEDS_A_PERSON).toContain(STATUS.brokeOff);
    expect(NO_MORE_CALLS).not.toContain(STATUS.brokeOff);
  });
  it("the sheet says what happened and what to do", () => {
    const p = progressFor(c, dir, new Map() as never, { drafts: {} } as never, NOW);
    expect(p.call_progress).toBe("🟡 Picked up — call ended early");
    expect(p.what_to_do).toMatch(/Not retried automatically/);
  });
});
