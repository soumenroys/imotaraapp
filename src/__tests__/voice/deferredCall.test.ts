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
  it("🔴 a held call that is RINGING NOW, 10 h after we placed it, is waited for (29 Oct)", () => {
    for (const status of ["queued", "initiated", "ringing", "in-progress", "call-disconnected"]) {
      // "wait" or "deferred" — both leave the row "Calling" so the result is taken when it comes.
      expect(["wait", "deferred"], status).toContain(reconcileVerdict({ final: false, status }, 10.5 * H));
    }
  });
  it("a call the service no longer reports at all frees the line after 3 hours", () => {
    expect(reconcileVerdict(null, 2 * H)).toBe("wait");
    expect(reconcileVerdict(null, 4 * H)).toBe("no_answer");
    expect(reconcileVerdict({ final: false, status: "" }, 4 * H)).toBe("no_answer");
  });
  it("…and a live status is not waited on for ever", () => {
    expect(reconcileVerdict({ final: false, status: "in-progress" }, (DEFERRED_WAIT_HOURS + 1) * H)).toBe("no_answer");
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
