/**
 * ⛔ AND THE ROUTE ACTUALLY CALLS IT.
 *
 * 🔴 WRITTEN BECAUSE THIS EXACT TRAP FIRED TWICE IN ONE DAY. The content-mix
 * rotation passed twelve unit tests — and all 3,826 — while the pipeline
 * ignored it entirely. The dials were read and never sent to the model. The
 * support line was accepted by the composer and passed by nobody.
 *
 * ⚠️ `retimeFor` is in exactly that position: pure, well tested, and worth
 * nothing unless the edit route reads the queue and calls it. ⇒ This invokes
 * the real PATCH handler with the database and the guard faked.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
process.env.SOCIAL_TOKEN_KEY ??= Buffer.alloc(32, 9).toString("base64");

/** Rows the fake `social_posts` query returns. */
let queued: Record<string, unknown>[] = [];
/** Every update the route applied, in order. */
let updates: { table: string; patch: Record<string, unknown>; id?: string }[] = [];
/** The schedule row the update returns. */
let scheduleRow: Record<string, unknown> = {};

vi.mock("@/app/api/admin/social/_guard", () => ({
  requireSocialAdmin: async () => ({ ok: true, actor: { id: "admin-1" } }),
  requireSocialOwner: async () => ({ ok: true, actor: { id: "admin-1" } }),
}));

vi.mock("@/lib/supabaseServer", () => ({
  getSupabaseAdmin: () => ({
    from: (table: string) => {
      if (table === "social_schedules") {
        return {
          update: (patch: Record<string, unknown>) => {
            updates.push({ table, patch });
            scheduleRow = { ...scheduleRow, ...patch };
            return { eq: () => ({ select: () => ({ single: async () => ({ data: scheduleRow, error: null }) }) }) };
          },
          select: () => ({ eq: () => ({ single: async () => ({ data: scheduleRow, error: null }) }) }),
        };
      }
      if (table === "social_posts") {
        const chain: Record<string, unknown> = {};
        let pending: Record<string, unknown> | null = null;
        let targetId: string | undefined;
        const self = {
          select: () => self,
          eq: (col: string, val: string) => { if (col === "id") targetId = val; return self; },
          in: () => self,
          not: async () => ({ data: queued, error: null }),
          update: (patch: Record<string, unknown>) => { pending = patch; return self; },
          then: undefined,
        } as never as Record<string, unknown> & {
          select: () => unknown; eq: (c: string, v: string) => unknown;
        };
        // ⚠️ `update(...).eq(id)` resolves; `select(...).in(...).not(...)` reads.
        (self as never as { eq: (c: string, v: string) => unknown }).eq = (col: string, val: string) => {
          if (col === "id") targetId = val;
          if (pending) {
            updates.push({ table, patch: pending, id: targetId });
            pending = null;
            return Promise.resolve({ error: null });
          }
          return self;
        };
        Object.assign(chain, self);
        return self;
      }
      throw new Error(`unexpected table: ${table}`);
    },
  }),
}));

const { PATCH } = await import("@/app/api/admin/social/schedules/[id]/route");
const { NextRequest } = await import("next/server");

const call = (body: Record<string, unknown>) =>
  PATCH(
    new NextRequest("https://www.imotara.com/api/admin/social/schedules/s1", {
      method: "PATCH",
      body: JSON.stringify(body),
      headers: { "content-type": "application/json" },
    }),
    { params: Promise.resolve({ id: "s1" }) },
  );

beforeEach(() => {
  updates = [];
  scheduleRow = {
    id: "s1",
    post_at: "17:30",
    days: [0, 1, 2, 3, 4, 5, 6],
    timezone: "Asia/Kolkata",
    platforms: ["facebook"],
    platform_times: null,
  };
  queued = [
    // 20 Oct 17:30 IST
    { id: "p1", platform: "facebook", status: "approved", scheduled_for: "2026-10-20T12:00:00.000Z" },
    // 21 Oct 17:30 IST
    { id: "p2", platform: "facebook", status: "needs_review", scheduled_for: "2026-10-21T12:00:00.000Z" },
  ];
});

describe("changing the time moves the queue with it", () => {
  it("🔴 both queued posts are moved to the new hour", async () => {
    const res = await call({ postAt: "19:30" });
    const json = await res.json();

    expect(res.status).toBe(200);
    const moved = updates.filter((u) => u.table === "social_posts");
    expect(moved, "the route changed the schedule and left the queue behind").toHaveLength(2);
    expect(moved.map((m) => m.patch.scheduled_for)).toEqual([
      "2026-10-20T14:00:00.000Z",
      "2026-10-21T14:00:00.000Z",
    ]);
    // ⚠️ And it says so, rather than moving somebody's queue silently.
    expect(json.retimed.moved).toBe(2);
    expect(json.retimed.note).toMatch(/SECOND post/i);
  });

  it("⛔ an edit that does not touch the clock leaves the queue entirely alone", async () => {
    // 🔑 Otherwise every tone tweak rewrites ten days of timestamps.
    await call({ tone: "gentle_plain" });
    expect(updates.filter((u) => u.table === "social_posts")).toHaveLength(0);
  });

  it("⚠️ unticking a day reports the orphan instead of moving or deleting it", async () => {
    // 20 and 21 Oct 2026 are Tue and Wed. Run Sundays only.
    const res = await call({ days: [0] });
    const json = await res.json();
    expect(updates.filter((u) => u.table === "social_posts")).toHaveLength(0);
    expect(json.retimed.orphaned.sort()).toEqual(["p1", "p2"]);
  });
});
