// src/__tests__/social/youtubeViewsAreCounted.test.ts
// 🔑 6 Nov 2026 (owner: "collect YouTube … views"): 14 Shorts had no figure at all.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fetchYouTubeVideoStats } from "@/lib/social/adapters/youtube";

const ok = (body: unknown) => (async () => new Response(JSON.stringify(body), { status: 200 })) as unknown as typeof fetch;

describe("reading our Shorts' counters", () => {
  it("reads views, likes and comments per video, as numbers", async () => {
    const r = await fetchYouTubeVideoStats({
      accessToken: "t",
      videoIds: ["a", "b"],
      fetchImpl: ok({ items: [{ id: "a", statistics: { viewCount: "42", likeCount: "3", commentCount: "0" } }, { id: "b", statistics: { viewCount: "7" } }] }),
    });
    expect(r.ok && r.stats.a).toMatchObject({ views: 42, likes: 3, comments: 0 });
    // ⛔ hidden likes are NOT zero likes
    expect(r.ok && r.stats.b).toMatchObject({ views: 7, likes: null, comments: null });
  });

  it("asks once for many — one call, ids joined, the token in the header (never the URL)", async () => {
    const calls: { url: string; auth: string }[] = [];
    const f = (async (url: string, init: RequestInit) => {
      calls.push({ url, auth: String((init.headers as Record<string, string>).Authorization) });
      return new Response(JSON.stringify({ items: [] }), { status: 200 });
    }) as unknown as typeof fetch;
    await fetchYouTubeVideoStats({ accessToken: "tok", videoIds: ["a", "b", "c"], fetchImpl: f });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toContain("part=statistics&id=a,b,c");
    expect(calls[0].url).not.toContain("tok");
    expect(calls[0].auth).toBe("Bearer tok");
  });

  it("a 403 (grant made before the read scope existed) says to RE-CONNECT", async () => {
    const f = (async () => new Response('{"error":{"code":403,"message":"Request had insufficient authentication scopes."}}', { status: 403 })) as unknown as typeof fetch;
    const r = await fetchYouTubeVideoStats({ accessToken: "t", videoIds: ["a"], fetchImpl: f });
    expect(r.ok).toBe(false);
    expect(!r.ok && r.message).toMatch(/re-connect YouTube/);
  });

  it("no ids ⇒ no call", async () => {
    let called = false;
    const f = (async () => { called = true; return new Response("{}"); }) as unknown as typeof fetch;
    expect(await fetchYouTubeVideoStats({ accessToken: "t", videoIds: [], fetchImpl: f })).toEqual({ ok: true, stats: {} });
    expect(called).toBe(false);
  });
});

describe("the daily stats job reads YouTube", () => {
  const src = readFileSync("src/lib/social/stats.ts", "utf8");
  it("routes a YouTube account to its own reader, with a MINTED token", () => {
    expect(src).toMatch(/if \(cred\.platform === "youtube"\) return captureYouTubePostStats/);
    expect(src).toMatch(/loadCredentialFor\(db, accountId, "youtube"\)/);
  });
  it("views land in `impressions`, the column every chart reads", () => {
    expect(src).toMatch(/impressions: st\.views/);
  });
});
