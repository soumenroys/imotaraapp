/**
 * 🔴 A VIDEO IS NOT A PICTURE WITH MORE FRAMES — it is a different edge, a
 * different field name and a different order of magnitude of waiting. Each of
 * those three fails SILENTLY if you assume otherwise, which is why this file
 * exists before any video has ever been published.
 *
 *   · Facebook: `/feed` cannot take a video. `/{page}/videos` publishes in ONE
 *     call, unlike the photo path where the upload is `published=false` and
 *     `/feed` is the only thing that posts.
 *   · Facebook's caption field is `description`. A video posted with
 *     `message` goes out with an EMPTY caption and no error.
 *   · Instagram has no "video post" any more — a video is a REEL, and one
 *     posted without `media_type=REELS` is rejected with an error about the
 *     image, which reads like a bad file.
 *   · A reel container takes MINUTES. The image budget is 24 seconds, and
 *     giving up cancels nothing: the container keeps processing at Meta's
 *     end, so a retry publishes the reel twice.
 */

import { describe, it, expect } from "vitest";
import { publishVideoToFacebook } from "@/lib/social/adapters/facebook";
import { publishReelToInstagram } from "@/lib/social/adapters/instagram";

const PAGE = "1222416224285686";
const IG = "17841400000000001";
const VIDEO = "https://www.imotara.com/api/social/video/p1?t=abc";

type Call = { url: string; method: string; body: string; params: URLSearchParams };

function fakeGraph(over: Partial<{ status: unknown[]; videoId: unknown; publish: unknown }> = {}) {
  const calls: Call[] = [];
  let statusIndex = 0;
  const statuses = over.status ?? [{ status_code: "FINISHED" }];

  const impl = (async (url: string | URL, init?: RequestInit) => {
    const u = String(url);
    const body = typeof init?.body === "string" ? init.body : "";
    calls.push({ url: u, method: init?.method ?? "GET", body, params: new URLSearchParams(body) });
    const json = (v: unknown) => ({ json: async () => v }) as unknown as Response;

    if (u.includes("me/accounts")) {
      return json({
        data: [{ id: PAGE, name: "Imotara", access_token: "PAGE-TOKEN",
                 instagram_business_account: { id: IG, username: "imotaraofficial" } }],
      });
    }
    if (u.includes("/videos")) return json(over.videoId ?? { id: "VIDEO-1" });
    if (u.includes("access_token") && u.includes("fields=access_token")) return json({ access_token: "PAGE-TOKEN" });
    if (u.includes("/media_publish")) return json(over.publish ?? { id: "MEDIA-1" });
    if (u.includes("/media")) return json({ id: "REEL-CONTAINER-1" });
    if (u.includes("permalink")) return json({ permalink: "https://www.instagram.com/reel/ABC/" });
    if (u.includes("status_code")) {
      const next = statuses[Math.min(statusIndex, statuses.length - 1)];
      statusIndex += 1;
      return json(next);
    }
    return json({ access_token: "PAGE-TOKEN" });
  }) as unknown as typeof fetch;

  return { impl, calls };
}

describe("Facebook takes video on a different edge", () => {
  it("posts to /videos, never to /feed", async () => {
    const g = fakeGraph();
    const r = await publishVideoToFacebook({ token: "sys", pageId: PAGE, message: "A caption.", videoUrl: VIDEO, fetchImpl: g.impl });
    expect(r.ok).toBe(true);
    expect(g.calls.some((c) => c.url.includes("/videos"))).toBe(true);
    // ⛔ /feed cannot carry a video and would publish the words alone.
    expect(g.calls.some((c) => c.url.includes("/feed"))).toBe(false);
  });

  it("⛔ the caption goes in `description` — `message` is silently ignored here", async () => {
    /**
     * 🔴 THE FAILURE THAT LOOKS LIKE SUCCESS. Facebook accepts `message` on
     * this edge, returns an id, and publishes the video with NO CAPTION.
     * Every word somebody approved, gone, with nothing reporting it.
     */
    const g = fakeGraph();
    await publishVideoToFacebook({ token: "sys", pageId: PAGE, message: "The words that must appear.", videoUrl: VIDEO, fetchImpl: g.impl });
    const post = g.calls.find((c) => c.url.includes("/videos"))!;
    expect(post.params.get("description")).toBe("The words that must appear.");
    expect(post.params.get("message")).toBeNull();
  });

  it("hands over a URL, not bytes", async () => {
    const g = fakeGraph();
    await publishVideoToFacebook({ token: "sys", pageId: PAGE, message: "x", videoUrl: VIDEO, fetchImpl: g.impl });
    expect(g.calls.find((c) => c.url.includes("/videos"))!.params.get("file_url")).toBe(VIDEO);
  });

  it("⛔ a missing id is not retried — one video must not become two", async () => {
    const g = fakeGraph({ videoId: {} });
    const r = await publishVideoToFacebook({ token: "sys", pageId: PAGE, message: "x", videoUrl: VIDEO, fetchImpl: g.impl });
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.message).toMatch(/not known whether the post exists/i);
    expect(g.calls.filter((c) => c.url.includes("/videos"))).toHaveLength(1);
  });
});

describe("Instagram has no video post, only a reel", () => {
  const run = (g: ReturnType<typeof fakeGraph>) =>
    publishReelToInstagram({ token: "sys", igUserId: IG, caption: "A caption.", videoUrl: VIDEO, fetchImpl: g.impl, sleep: async () => {} });

  it("⛔ sets media_type=REELS and video_url, not image_url", async () => {
    const g = fakeGraph();
    const r = await run(g);
    expect(r.ok).toBe(true);
    const container = g.calls.find((c) => c.method === "POST" && c.url.includes("/media") && !c.url.includes("/media_publish"))!;
    expect(container.params.get("media_type")).toBe("REELS");
    expect(container.params.get("video_url")).toBe(VIDEO);
    expect(container.params.get("image_url")).toBeNull();
  });

  it("still publishes in a separate call — a container is not a post", async () => {
    const g = fakeGraph();
    await run(g);
    const publish = g.calls.filter((c) => c.url.includes("/media_publish"));
    expect(publish).toHaveLength(1);
    expect(publish[0].params.get("creation_id")).toBe("REEL-CONTAINER-1");
  });

  it("⛔ waits MINUTES, not the image budget", async () => {
    /**
     * 🔴 An image container is usually FINISHED on the first poll. A reel is
     * fetched, transcoded and thumbnailed first. Giving up at 24 seconds
     * cancels NOTHING — the container keeps processing at Meta's end, so the
     * retry publishes the reel a second time.
     */
    const stillGoing = Array.from({ length: 20 }, () => ({ status_code: "IN_PROGRESS" }));
    const g = fakeGraph({ status: [...stillGoing, { status_code: "FINISHED" }] });
    const r = await run(g);
    expect(r.ok, "gave up before a realistic reel had finished").toBe(true);
    expect(g.calls.filter((c) => c.url.includes("status_code")).length).toBeGreaterThan(20);
  });

  it("and says so, with the real budget, when it truly never finishes", async () => {
    const g = fakeGraph({ status: [{ status_code: "IN_PROGRESS" }] });
    const r = await run(g);
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.message).toMatch(/still preparing/i);
    // ⚠️ The number in the message is the budget actually used, not the
    // image one — a message quoting 24s would send somebody looking at the
    // wrong thing entirely.
    expect(r.message).toMatch(/180s/);
    expect(g.calls.some((c) => c.url.includes("/media_publish"))).toBe(false);
  });
});
