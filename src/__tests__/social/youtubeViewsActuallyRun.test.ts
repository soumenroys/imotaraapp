// src/__tests__/social/youtubeViewsActuallyRun.test.ts
// 🔴 6 Nov 2026: the first live run said "a row but no stored token" — the job
// asked for an ACCESS token before noticing the channel was YouTube, which keeps
// a REFRESH token. The source-text test passed straight through it ⇒
// trap_text_assertions_cannot_see_reachability. This one RUNS the job.
import { it, expect, vi } from "vitest";

vi.mock("@/lib/social/channelCredentials", () => ({
  // ⚠️ What production really answers for a YouTube row.
  loadChannelCredential: vi.fn(async () => ({ ok: false, reason: "That channel has a row but no stored token." })),
  loadCredentialFor: vi.fn(async () => ({ ok: true, id: "yt", platform: "youtube", externalId: "UC", displayName: "Imotara", token: "minted" })),
}));
vi.mock("@/lib/social/adapters/youtube", async (orig) => ({
  ...(await orig<typeof import("@/lib/social/adapters/youtube")>()),
  fetchYouTubeVideoStats: vi.fn(async () => ({ ok: true, stats: { vid1: { views: 42, likes: 3, comments: 0, raw: {} } } })),
}));

import { capturePostStats } from "@/lib/social/stats";

it("a YouTube channel's Shorts are measured — reached through the minted token, stored as views", async () => {
  const upserts: Record<string, unknown>[] = [];
  const q = (rows: unknown) => {
    const b: Record<string, unknown> = {};
    for (const m of ["select", "eq", "not", "gte", "order", "limit"]) b[m] = () => b;
    b.maybeSingle = async () => ({ data: Array.isArray(rows) ? rows[0] : rows, error: null });
    b.then = (res: (v: unknown) => unknown) => Promise.resolve({ data: rows, error: null }).then(res);
    b.upsert = async (row: Record<string, unknown>) => { upserts.push(row); return { error: null }; };
    return b;
  };
  const db = {
    from: (t: string) =>
      t === "social_accounts" ? q([{ platform: "youtube" }])
      : t === "social_posts" ? q([{ id: "p1", external_post_id: "vid1" }])
      : q([]),
  } as never;

  const out = await capturePostStats(db, "yt");
  expect(out.problems).toEqual([]);
  expect(out.captured).toBe(1);
  expect(upserts[0]).toMatchObject({ post_id: "p1", impressions: 42, reactions: 3, comments: 0 });
});
