/**
 * ⛔ AND SOMETHING ACTUALLY CALLS IT.
 *
 * 🔴 THE TRAP THIS FILE EXISTS FOR, which this project has now hit three
 * times: a correct function that nothing invokes. `composePicture` accepted a
 * `support` from the day it was written and no render route ever passed one,
 * so no published card carried its second line — and every test that handed
 * compose a support passed ⇒ trap_text_assertions_cannot_see_reachability.
 *
 * ⚠️ `missedSlots` is in exactly that position: pure, well tested, and worth
 * nothing unless the cron reads the queue and calls it.
 *
 * 🔑 SO THIS INVOKES THE REAL ROUTE HANDLER, with the database and the mailer
 * faked and nothing else. ⛔ Not a source grep for `missedSlots(` — two of
 * those broke on a rename today and one of them had been silently measuring
 * an empty string. Calling the thing is the only check that cannot be
 * satisfied by text.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

process.env.SOCIAL_TOKEN_KEY ??= Buffer.alloc(32, 9).toString("base64");
process.env.CRON_SECRET = "test-cron-secret";

/** Rows the fake `social_posts` query returns. */
let queueRows: Record<string, unknown>[] = [];
/** What the alert was called with, or null if it never was. */
let alerted: { missed: unknown[]; summary: string } | null = null;

vi.mock("@/lib/social/alert", () => ({
  sendChannelAlert: async () => false,
  sendMissedSlotAlert: async (missed: unknown[], summary: string) => {
    alerted = { missed, summary };
    return true;
  },
}));

vi.mock("@/lib/supabaseServer", () => ({
  getSupabaseAdmin: () => ({
    from: (table: string) => {
      if (table === "social_accounts") {
        // ⚠️ No channels at all: this test is about the QUEUE half, and an
        // empty account list keeps the credential half out of the way.
        return { select: async () => ({ data: [], error: null }) };
      }
      if (table === "social_posts") {
        const chain = {
          select: () => chain,
          in: () => chain,
          gte: () => chain,
          order: async () => ({ data: queueRows, error: null }),
        };
        return chain;
      }
      throw new Error(`the route read an unexpected table: ${table}`);
    },
  }),
}));

vi.mock("@/lib/cron/heartbeat", () => ({ markCronFired: async () => {} }));

const { GET } = await import("@/app/api/cron/social-health/route");
const { NextRequest } = await import("next/server");

const call = () =>
  GET(
    new NextRequest("https://www.imotara.com/api/cron/social-health", {
      headers: { authorization: "Bearer test-cron-secret" },
    }),
  );

const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();

beforeEach(() => {
  queueRows = [];
  alerted = null;
});

describe("the health cron reads the queue, not only the channels", () => {
  it("🔴 raises the post whose slot went by unreviewed", async () => {
    queueRows = [
      {
        id: "p1",
        platform: "instagram",
        subject: "Someone to talk to at 3:17 am",
        status: "needs_review",
        scheduled_for: hoursAgo(2),
        attempts: 0,
      },
    ];
    const body = await (await call()).json();

    expect(body.ran).toBe(true);
    expect(body.missed, "the route did not look at the queue at all").toHaveLength(1);
    expect(body.missed[0].kind).toBe("unreviewed");
    expect(body.missedAlerted, "it found the problem and told nobody").toBe(true);
    expect(alerted!.summary).toMatch(/waiting for your approval/i);
  });

  it("⛔ sends nothing when the queue is healthy", async () => {
    /**
     * 🔑 The half that keeps the alert worth reading. A cron that mails every
     * morning regardless is a cron whose mail is filtered, and then the one
     * that matters is filtered too ⇒ the change-only comment above it.
     */
    queueRows = [
      { id: "p1", platform: "facebook", subject: "Later today", status: "approved",
        scheduled_for: new Date(Date.now() + 3_600_000).toISOString(), attempts: 0 },
    ];
    const body = await (await call()).json();
    expect(body.missed).toEqual([]);
    expect(body.missedAlerted).toBe(false);
    expect(alerted).toBeNull();
  });

  it("⚠️ an approved post that never went out reaches the alert as OURS", async () => {
    queueRows = [
      { id: "p2", platform: "facebook", subject: "Here at any hour", status: "approved",
        scheduled_for: hoursAgo(5), attempts: 0 },
    ];
    const body = await (await call()).json();
    expect(body.missed[0].kind).toBe("stuck");
    expect(alerted!.summary).toMatch(/not going out/i);
  });

  it("⛔ still refuses a caller that is not the scheduler", async () => {
    // ⚠️ The queue work must not have widened the door it rides in through.
    const res = await GET(new NextRequest("https://www.imotara.com/api/cron/social-health"));
    expect(res.status).toBe(401);
    expect(alerted).toBeNull();
  });
});
