/**
 * 🔴 #131, 21 Nov 2026 — THE ALARM THAT CRIED WOLF.
 *
 * "Nothing written for instagram — the slot will pass" (16 Nov) and
 * "Nothing written for x — the slot will pass" (19 Nov 00:01). Both slots were
 * retried by the queue and PUBLISHED on time (IG 19 Nov 14:30Z, X 20 Nov
 * 13:30Z). The refusals were the repetition check doing its job. The mail
 * fired on the first refusal of a slot days away, said it would pass, and
 * never said which slot it meant.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { refusalVerdict, istLabel, ALERT_WITHIN_HOURS } from "@/lib/social/queueHealth";
import { BACKOFF_MINUTES } from "@/lib/social/horizon";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

describe("refusalVerdict — is a refused slot actually at risk?", () => {
  it("🔑 the 19 Nov case: X slot ~37 h away, first refusal ⇒ NO mail, and it is not lost", () => {
    const now = new Date("2026-11-18T18:31:00Z"); // 19 Nov 00:01 IST
    const v = refusalVerdict("2026-11-20T07:30:00Z", 1, now);
    expect(v.alert).toBe(false);
    expect(v.willPass).toBe(false);
    expect(v.nextTry).toBe("2026-11-18T18:36:00.000Z"); // 5-minute back-off
  });

  it("mails when the slot is inside the approval window", () => {
    const now = new Date("2026-11-20T00:00:00Z");
    const v = refusalVerdict("2026-11-20T13:30:00Z", 1, now);
    expect(v.alert).toBe(true);
    expect(v.willPass).toBe(false);
  });

  it("says it WILL pass only when no retry can land before the slot", () => {
    const now = new Date("2026-11-20T13:00:00Z");
    // attempt 4 ⇒ 180-minute wait, slot in 30 min
    expect(refusalVerdict("2026-11-20T13:30:00Z", 4, now).willPass).toBe(true);
    // attempt 1 ⇒ 5-minute wait, slot in 30 min
    expect(refusalVerdict("2026-11-20T13:30:00Z", 1, now).willPass).toBe(false);
  });

  it("mails ONCE when a far slot reaches the back-off cap — a problem with the brief", () => {
    const now = new Date("2026-11-10T00:00:00Z");
    const far = "2026-11-19T00:00:00Z";
    expect(refusalVerdict(far, BACKOFF_MINUTES.length, now).alert).toBe(true);
    // ⛔ not again on every 6-hourly retry after that
    expect(refusalVerdict(far, BACKOFF_MINUTES.length + 1, now).alert).toBe(false);
    expect(refusalVerdict(far, BACKOFF_MINUTES.length - 1, now).alert).toBe(false);
  });

  it("⛔ never silent near the slot — the 19 Oct gap stays closed", () => {
    const now = new Date("2026-11-20T00:00:00Z");
    const edge = new Date(now.getTime() + ALERT_WITHIN_HOURS * 3_600_000).toISOString();
    expect(refusalVerdict(edge, 1, now).alert).toBe(true);
  });

  it("an unreadable slot time is treated as at risk, not ignored", () => {
    const v = refusalVerdict("not a date", 1, new Date());
    expect(v.alert).toBe(true);
    expect(v.willPass).toBe(true);
  });
});

describe("istLabel", () => {
  it("names the slot the way the schedule does", () => {
    expect(istLabel("2026-11-20T13:30:00Z")).toBe("Fri 20 Nov, 19:00 IST");
  });
});

describe("the queue cron and the mail", () => {
  const queue = read("src/app/api/cron/social-queue/route.ts");
  const alert = read("src/lib/social/alert.ts");

  it("filters refusals through refusalVerdict before mailing", () => {
    const call = queue.indexOf("await sendQueueAlert(");
    const filt = queue.lastIndexOf("refusalVerdict(", call);
    expect(filt).toBeGreaterThan(-1);
    expect(queue.slice(filt, call)).toContain("verdict.alert");
  });

  it("every refusal carries its slot and attempt", () => {
    // ⚠️ Only the SLOT loop — the card-attach loop above it refuses existing posts, which have no slot.
    const loop = queue.slice(queue.indexOf("for (const want"), queue.indexOf("await sendQueueAlert("));
    const refusals = loop.match(/result: "refused"[\s\S]{0,120}/g) ?? [];
    expect(refusals.length).toBeGreaterThanOrEqual(3);
    for (const r of refusals) {
      expect(r).toContain("scheduledFor: want.scheduledFor");
      expect(r).toContain("attempt: soFar + 1");
    }
  });

  it("the mail names the slot and says 'will pass' only when it will", () => {
    const fn = alert.slice(alert.indexOf("export async function sendQueueAlert"));
    expect(fn).toContain("istLabel(r.scheduledFor)");
    expect(fn).toMatch(/anyWillPass\s*\?/);
    expect(fn).toMatch(/retrying/);
  });
});
