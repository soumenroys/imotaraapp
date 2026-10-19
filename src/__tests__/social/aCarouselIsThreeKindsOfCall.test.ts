/**
 * 🔴 A CAROUSEL IS THREE KINDS OF CALL AND THE FIRST TWO LOOK LIKE SUCCESS.
 *
 * A single-image post was already two calls, where stopping after the first
 * returns a container id that reads exactly like a post id ⇒
 * aContainerIsNotAPost.test.ts. A carousel adds a whole layer of that: one
 * container per slide, then a container made OF those containers, then the one
 * call that publishes. Every step returns `{id}`.
 *
 * ⛔ AND THE TWO FAILURES THAT WOULD NEVER BE NOTICED:
 *   · a caption sent on a CHILD is accepted and silently discarded — the post
 *     publishes with no words at all
 *   · `children` in the wrong order publishes a shuffled carousel in which
 *     every individual card is perfectly fine
 *
 * Everything here runs against a fake Graph, because the real one publishes.
 */

import { describe, it, expect } from "vitest";
import {
  publishCarouselToInstagram,
  CAROUSEL_MIN,
  CAROUSEL_MAX,
} from "@/lib/social/adapters/instagram";

const IG = "17841400000000001";
const PAGE = "1222416224285686";
const SYSTEM_TOKEN = "SYSTEM-TOKEN-xxxxxxxxxxxxxxxxxxxx";
const PAGE_TOKEN = "PAGE-TOKEN-yyyyyyyyyyyyyyyyyyyyyy";

const CARDS = [
  "https://www.imotara.com/api/social/card/p1?t=aaa",
  "https://www.imotara.com/api/social/card/p1?t=bbb&s=1",
  "https://www.imotara.com/api/social/card/p1?t=ccc&s=2",
];

type Call = { url: string; method: string; body: string; params: URLSearchParams };

/**
 * A Graph that behaves, unless a step is told to misbehave.
 *
 * ⚠️ EVERY CONTAINER GETS A DISTINCT ID. The single-image fake returns one id
 * for every `/media` call, which is fine there and would make this whole file
 * vacuous: `children=CONTAINER-1,CONTAINER-1,CONTAINER-1` would pass an order
 * assertion by accident.
 */
function fakeGraph(
  overrides: Partial<{
    status: unknown[];
    childFails: number;
    publish: unknown;
  }> = {},
) {
  const calls: Call[] = [];
  let made = 0;
  let statusIndex = 0;
  const statuses = overrides.status ?? [{ status_code: "FINISHED" }];

  const impl = (async (url: string | URL, init?: RequestInit) => {
    const u = String(url);
    const body = typeof init?.body === "string" ? init.body : "";
    calls.push({ url: u, method: init?.method ?? "GET", body, params: new URLSearchParams(body) });
    const json = (value: unknown) => ({ json: async () => value }) as unknown as Response;

    if (u.includes("me/accounts")) {
      return json({
        data: [
          {
            id: PAGE,
            name: "Imotara",
            access_token: PAGE_TOKEN,
            instagram_business_account: { id: IG, username: "imotaraofficial" },
          },
        ],
      });
    }
    if (u.includes("/media_publish")) return json(overrides.publish ?? { id: "MEDIA-1" });
    if (u.includes("/media")) {
      made += 1;
      if (overrides.childFails === made) return json({ error: { message: "Bad image", code: 9004 } });
      const isParent = new URLSearchParams(body).get("media_type") === "CAROUSEL";
      return json({ id: isParent ? "CAROUSEL-1" : `CHILD-${made}` });
    }
    if (u.includes("permalink")) return json({ permalink: "https://www.instagram.com/p/ABC/" });
    if (u.includes("status_code")) {
      const next = statuses[Math.min(statusIndex, statuses.length - 1)];
      statusIndex += 1;
      return json(next);
    }
    return json({ username: "imotaraofficial" });
  }) as unknown as typeof fetch;

  return { impl, calls };
}

const run = (g: ReturnType<typeof fakeGraph>, imageUrls = CARDS, caption = "a caption") =>
  publishCarouselToInstagram({
    token: SYSTEM_TOKEN,
    igUserId: IG,
    caption,
    imageUrls,
    fetchImpl: g.impl,
    sleep: async () => {},
  });

/** The `/media` POSTs, in the order they were sent. */
const containerPosts = (g: ReturnType<typeof fakeGraph>) =>
  g.calls.filter((c) => c.method === "POST" && c.url.includes("/media") && !c.url.includes("/media_publish"));

describe("the three kinds of call, in order", () => {
  it("makes one child per card, then the carousel, then publishes", async () => {
    const g = fakeGraph();
    const out = await run(g);
    expect(out.ok).toBe(true);

    const posts = containerPosts(g);
    expect(posts).toHaveLength(CARDS.length + 1);

    // One child per card, each carrying its own image.
    for (const [i, url] of CARDS.entries()) {
      expect(posts[i].params.get("image_url")).toBe(url);
      expect(posts[i].params.get("is_carousel_item")).toBe("true");
    }

    // Then the parent, and nothing else.
    expect(posts[CARDS.length].params.get("media_type")).toBe("CAROUSEL");
    expect(posts[CARDS.length].params.get("is_carousel_item")).toBeNull();

    // And the publish is last, on the CAROUSEL, not on a child.
    const publishCall = g.calls.filter((c) => c.url.includes("/media_publish"));
    expect(publishCall).toHaveLength(1);
    expect(publishCall[0].params.get("creation_id")).toBe("CAROUSEL-1");
    expect(g.calls.indexOf(publishCall[0])).toBeGreaterThan(g.calls.indexOf(posts[CARDS.length]));
  });

  it("⛔ puts the children in the order the cards were given", async () => {
    // 🔴 A shuffled carousel is the failure nobody reports, because each card
    // is individually correct. Pinned on the VALUE, not on the field existing.
    const g = fakeGraph();
    await run(g);
    const parent = containerPosts(g).at(-1)!;
    expect(parent.params.get("children")).toBe("CHILD-1,CHILD-2,CHILD-3");
  });

  it("⛔ the caption goes on the carousel and on NO child", async () => {
    /**
     * 🔴 Meta accepts `caption` on a child, returns a container id, and drops
     * the words. The post publishes looking fine and saying nothing.
     */
    const g = fakeGraph();
    await run(g, CARDS, "The caption that must appear.");
    const posts = containerPosts(g);
    for (const child of posts.slice(0, CARDS.length)) {
      expect(child.params.get("caption")).toBeNull();
    }
    expect(posts.at(-1)!.params.get("caption")).toBe("The caption that must appear.");
  });

  it("waits for every child AND for the carousel itself", async () => {
    // ⚠️ A carousel assembled from a child Meta has not finished fetching
    // fails at the parent with an error about "media" — which reads like a bad
    // card rather than a race, and sent me looking at the renderer.
    const g = fakeGraph();
    await run(g);
    const waits = g.calls.filter((c) => c.url.includes("status_code"));
    expect(waits).toHaveLength(CARDS.length + 1);
  });

  it("⛔ and ACTS on the carousel's own status, not just asks for it", async () => {
    /**
     * 🔴 THE MUTATION THAT SURVIVED THE TEST ABOVE. Replacing the parent's
     * `if (!assembled.ok) return` with `void assembled` leaves the wait in
     * place — the call is still made, the count is still right — and publishes
     * a carousel Meta has just said it could not assemble.
     *
     * ⚠️ Counting calls proves a question was ASKED. Only a bad answer proves
     * it was READ.
     */
    const g = fakeGraph({
      // The three children finish; the carousel itself does not.
      status: [
        { status_code: "FINISHED" },
        { status_code: "FINISHED" },
        { status_code: "FINISHED" },
        { status_code: "ERROR", status: "children unavailable" },
      ],
    });
    const out = await run(g);
    expect(out.ok).toBe(false);
    expect(g.calls.some((c) => c.url.includes("/media_publish"))).toBe(false);
  });

  it("the caption and the image are in the BODY, never the query string", async () => {
    // ⚠️ A token or a caption in a URL is a token or a caption in a log.
    const g = fakeGraph();
    await run(g);
    for (const c of containerPosts(g)) {
      expect(c.url).not.toContain("caption");
      expect(c.url).not.toContain("access_token");
      expect(c.url).not.toContain("image_url");
    }
  });
});

describe("what it refuses to publish", () => {
  it("⛔ refuses a single card rather than posting it as a carousel", async () => {
    // A one-card "carousel" is a single-image post. Meta rejects it, and
    // refusing here says so in words a human can act on.
    const g = fakeGraph();
    const out = await run(g, [CARDS[0]]);
    expect(out.ok).toBe(false);
    if (out.ok) throw new Error("unreachable");
    expect(out.message).toMatch(/single picture/i);
    expect(containerPosts(g)).toHaveLength(0);
  });

  it("⛔ refuses 11 cards rather than silently truncating", async () => {
    /**
     * 🔴 THE LITERAL 11, NOT `CAROUSEL_MAX + 1`. Written the derived way this
     * was a MIRROR TEST: raising the constant to 99 raised the test with it,
     * and the mutation survived. Meta's limit is 10 — a number in their
     * documentation, not a number in our source ⇒ it is written out here.
     */
    const g = fakeGraph();
    const many = Array.from({ length: 11 }, (_, i) => `https://x.test/${i}.jpg`);
    const out = await run(g, many);
    expect(out.ok).toBe(false);
    if (out.ok) throw new Error("unreachable");
    expect(out.message).toContain("11");
    expect(containerPosts(g)).toHaveLength(0);
  });

  it("⛔ the limits are Meta's, written out", () => {
    // ⚠️ The one assertion in this file that is allowed to name the constants:
    // it exists to pin them to the documented 2–10, so the tests above can
    // stay literal without the pair drifting apart unnoticed.
    expect([CAROUSEL_MIN, CAROUSEL_MAX]).toEqual([2, 10]);
  });

  it("drops blank urls, and then refuses if too few are left", async () => {
    const g = fakeGraph();
    const out = await run(g, [CARDS[0], "", "   "]);
    expect(out.ok).toBe(false);
    expect(containerPosts(g)).toHaveLength(0);
  });

  it("⛔ stops at the first bad card instead of publishing a short carousel", async () => {
    // 🔴 Continuing past a failed child would publish two cards out of three —
    // a post that is wrong in a way nobody can see from the outside.
    const g = fakeGraph({ childFails: 2 });
    const out = await run(g);
    expect(out.ok).toBe(false);
    if (out.ok) throw new Error("unreachable");
    expect(out.message).toMatch(/Card 2 of 3/);
    expect(out.message).toMatch(/Nothing was published/);
    expect(g.calls.some((c) => c.url.includes("/media_publish"))).toBe(false);
  });

  it("⛔ names the card when one of them never finishes", async () => {
    const g = fakeGraph({ status: [{ status_code: "FINISHED" }, { status_code: "ERROR", status: "unfetchable" }] });
    const out = await run(g);
    expect(out.ok).toBe(false);
    if (out.ok) throw new Error("unreachable");
    expect(out.message).toMatch(/Card 2 of 3/);
    expect(out.message).toMatch(/IMAGE, not the token/);
    expect(g.calls.some((c) => c.url.includes("/media_publish"))).toBe(false);
  });

  it("⛔ a publish that returns no media id is not a success", async () => {
    const g = fakeGraph({ publish: {} });
    const out = await run(g);
    expect(out.ok).toBe(false);
    if (out.ok) throw new Error("unreachable");
    expect(out.message).toMatch(/no media id/i);
  });
});
