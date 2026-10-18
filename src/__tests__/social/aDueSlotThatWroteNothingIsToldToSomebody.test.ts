/**
 * 🔴 THE GAP, FOUND AT MIDNIGHT ON 19 Oct, hours before the first unattended
 * Instagram slot.
 *
 * The health cron alerts when a TOKEN stops working. Nothing alerted when
 * GENERATION refused — and generation refuses for several honest reasons:
 * three drafts rejected by the gate, a channel that has no text-only post and
 * no card could be made, a model outage.
 *
 * ⛔ So the failure mode was: the queue refuses at 15:00, nothing publishes at
 * 17:00, and the only symptom is an empty feed. That is precisely what this
 * feature was built to prevent, and every "refused loudly" built into the
 * pipeline reached only the HTTP response Vercel Cron throws away
 * ⇒ trap_a_dead_cron_fails_where_nobody_is_watching.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const strip = (s: string) =>
  s
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .split("\n")
    .filter((l) => !l.trimStart().startsWith("import "))
    .join("\n");

const queue = strip(read("src/app/api/cron/social-queue/route.ts"));
const alert = read("src/lib/social/alert.ts");

describe("a schedule that was due and wrote nothing", () => {
  it("sends an alert", () => {
    // ⚠️ Anchored on the CALL, not the name — the import line satisfied
    // `toContain` three separate times tonight.
    expect(queue).toContain("await sendQueueAlert(");
  });

  it("alerts on refusals and NOT on the ordinary outcomes", () => {
    /**
     * ⛔ `already-written` is the idempotency guard doing its job on a cron
     * that runs every minute, and `skipped` means a post exists but a
     * duplicate subject was caught. Alerting on either would be a daily email
     * that teaches somebody to filter the one that matters.
     */
    const call = queue.indexOf("await sendQueueAlert(");
    const filter = queue.lastIndexOf('o.result === "refused"', call);
    expect(filter).toBeGreaterThan(-1);
    expect(filter).toBeLessThan(call);

    const block = queue.slice(filter, call);
    expect(block).not.toContain("already-written");
    expect(block).not.toContain('"skipped"');
  });

  it("⛔ never fails the run over an alert", () => {
    // An alert that cannot send must not cost the posts that DID get written.
    const call = queue.indexOf("await sendQueueAlert(");
    const before = queue.slice(Math.max(0, call - 200), call);
    expect(before).toContain("try {");
  });

  it("carries the reason, not just the fact", () => {
    // ▶️ "Three drafts were written and none passed" is actionable.
    // "A schedule failed" is not.
    const call = queue.indexOf("await sendQueueAlert(");
    const args = queue.slice(call, call + 320);
    expect(args).toContain("o.detail");
    expect(args).toContain("platform");
  });
});

describe("what the alert actually says", () => {
  it("goes to the social mailbox, like every other social alert", () => {
    // 🔑 social@imotara.com is the address on every profile, so it is the one
    // somebody is already reading when they are thinking about social.
    expect(alert).toContain('const TO = "social@imotara.com"');
  });

  it("⛔ does not tell somebody to re-paste a token", () => {
    /**
     * 🔴 THE WRONG REMEDY IS WORSE THAN NO ALERT. The channel and its token
     * are fine; what failed is the writing. Sending somebody to replace a
     * working credential is the mistake the Facebook adapter already has a
     * whole error taxonomy to avoid.
     */
    const fn = alert.slice(alert.indexOf("export async function sendQueueAlert"));
    expect(fn).toMatch(/the channel and its token are fine/i);
    expect(fn).not.toMatch(/generate a new token|paste it in/i);
  });

  it("says plainly that the slot will pass", () => {
    const fn = alert.slice(alert.indexOf("export async function sendQueueAlert"));
    expect(fn).toMatch(/the slot will (simply )?pass/i);
    // ⚠️ And where to read the attempts, which is the only actionable part.
    expect(fn).toContain("https://www.imotara.com/admin/social");
  });

  it("stays silent when there is nothing to report", () => {
    const fn = alert.slice(alert.indexOf("export async function sendQueueAlert"));
    expect(fn).toMatch(/if \(refused\.length === 0\) return false;/);
  });

  it("logs loudly rather than swallowing when email is not configured", () => {
    // ⛔ A failed alert about a failed write is two silent failures stacked.
    const fn = alert.slice(alert.indexOf("export async function sendQueueAlert"));
    expect(fn).toContain("isResendConfigured()");
    expect(fn).toContain("console.error");
  });
});
