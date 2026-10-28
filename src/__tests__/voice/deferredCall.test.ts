/**
 * 🔴 A CALL THE CALL SERVICE DEFERRED KEEPS ITS RESULT — found by the
 * end-to-end test, 28 Oct 2026. Bolna held a 23:30 call as "rescheduled" for
 * its 09:00–21:00 guardrail; our reconcile would have written "No answer" at
 * 02:30 and discarded the real result at 09:00 (safety flags included), and a
 * retry could have rung the person twice.
 */
import { describe, it, expect } from "vitest";
import { reconcileVerdict, DEFERRED_WAIT_HOURS } from "@/lib/voice/dispatch";

const H = 3600_000;

describe("a call still 'Calling' after a while", () => {
  it("🔴 'rescheduled' waits for the result — even 10 hours on", () => {
    expect(reconcileVerdict({ final: false, status: "rescheduled" }, 10 * H)).toBe("deferred");
  });
  it("…but not for ever", () => {
    expect(reconcileVerdict({ final: false, status: "rescheduled" }, (DEFERRED_WAIT_HOURS + 1) * H)).toBe("no_answer");
  });
  it("a final result is applied", () => {
    expect(reconcileVerdict({ final: true, status: "completed" }, 10 * H)).toBe("apply");
  });
  it("an ordinary call gets 3 hours, then frees the line", () => {
    expect(reconcileVerdict({ final: false, status: "in-progress" }, 2 * H)).toBe("wait");
    expect(reconcileVerdict({ final: false, status: "in-progress" }, 4 * H)).toBe("no_answer");
  });
  it("⛔ a completed call with no outcome goes to a person, never back to retries", () => {
    expect(reconcileVerdict({ final: false, status: "completed" }, 4 * H)).toBe("review");
  });
});

import { callServiceWarning } from "@/lib/voice/slots";

describe("an admin's call time the call service will hold is warned about, never refused (owner, 28 Oct 2026)", () => {
  it("23:30 in Kolkata is warned", () => {
    expect(callServiceWarning(new Date("2026-10-28T18:00:00Z"), "Asia/Kolkata")).toMatch(/09:00–21:00/);
  });
  it("11:00 in Kolkata is fine", () => {
    expect(callServiceWarning(new Date("2026-10-28T05:30:00Z"), "Asia/Kolkata")).toBe("");
  });
  it("judged in THEIR zone: 23:30 IST is 18:00 in London — fine", () => {
    expect(callServiceWarning(new Date("2026-10-28T18:00:00Z"), "Europe/London")).toBe("");
  });
});
