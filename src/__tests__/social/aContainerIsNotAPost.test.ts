/**
 * 🔴 THE INSTAGRAM FAILURE THAT MAKES NO NOISE.
 *
 * Publishing to Instagram is two calls. `/media` builds a CONTAINER and
 * returns an id that looks exactly like a successful post id. `/media_publish`
 * is the one that puts it on the timeline. Code that stops after the first
 * returns `{ok: true}`, writes a `published` row, records an external id — and
 * nothing was ever published. ⛔ No error, anywhere, ever.
 *
 * Everything here is run against a fake Graph, because the real one publishes.
 */

import { describe, it, expect } from "vitest";
import {
  publishToInstagram,
  instagramLink,
  fetchInstagramStats,
  fetchInstagramPostStats,
} from "@/lib/social/adapters/instagram";

const IG = "17841400000000001";
const PAGE = "1222416224285686";
const SYSTEM_TOKEN = "SYSTEM-TOKEN-xxxxxxxxxxxxxxxxxxxx";
const PAGE_TOKEN = "PAGE-TOKEN-yyyyyyyyyyyyyyyyyyyyyy";

type Call = { url: string; method: string; body: string };

/** A Graph that behaves, unless a step is told to misbehave. */
function fakeGraph(
  overrides: Partial<{
    accounts: unknown;
    media: unknown;
    status: unknown[];
    publish: unknown;
    permalink: unknown;
  }> = {},
) {
  const calls: Call[] = [];
  let statusIndex = 0;
  const statuses = overrides.status ?? [{ status_code: "FINISHED" }];

  const impl = (async (url: string | URL, init?: RequestInit) => {
    const u = String(url);
    const body = typeof init?.body === "string" ? init.body : "";
    calls.push({ url: u, method: init?.method ?? "GET", body });

    const json = (value: unknown) => ({ json: async () => value }) as unknown as Response;

    if (u.includes("me/accounts")) {
      return json(
        overrides.accounts ?? {
          data: [
            { id: "999", name: "Some other Page", access_token: "OTHER-TOKEN" },
            {
              id: PAGE,
              name: "Imotara",
              access_token: PAGE_TOKEN,
              instagram_business_account: { id: IG, username: "imotaraofficial" },
            },
          ],
        },
      );
    }
    if (u.includes("/media_publish")) return json(overrides.publish ?? { id: "MEDIA-1" });
    if (u.includes("/media")) return json(overrides.media ?? { id: "CONTAINER-1" });
    if (u.includes("/insights")) return json({ data: [{ name: "saved", values: [{ value: 9 }] }] });
    if (u.includes("permalink")) return json(overrides.permalink ?? { permalink: "https://www.instagram.com/p/ABC/" });
    if (u.includes("status_code")) {
      const next = statuses[Math.min(statusIndex, statuses.length - 1)];
      statusIndex += 1;
      return json(next);
    }
    return json({ username: "imotaraofficial", followers_count: 81, media_count: 12 });
  }) as unknown as typeof fetch;

  return { impl, calls };
}

const publish = (g: ReturnType<typeof fakeGraph>, caption = "a caption") =>
  publishToInstagram({
    token: SYSTEM_TOKEN,
    igUserId: IG,
    caption,
    imageUrl: "https://www.imotara.com/api/social/card/x?t=y",
    fetchImpl: g.impl,
    // ⚠️ Instant, so the container wait does not make this suite take 24s.
    sleep: async () => {},
  });

describe("publishing is the second call, not the first", () => {
  it("calls media_publish and reports the media id, not the container id", async () => {
    const g = fakeGraph();
    const r = await publish(g);
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    /**
     * 🔴 The whole point. `CONTAINER-1` is what `/media` returned and it is a
     * perfectly plausible post id — a publisher that stopped there would
     * write it to `external_post_id` and look healthy forever.
     */
    expect(r.mediaId).toBe("MEDIA-1");
    expect(r.mediaId).not.toBe("CONTAINER-1");
    expect(g.calls.some((c) => c.url.includes("/media_publish") && c.method === "POST")).toBe(true);
    expect(g.calls.find((c) => c.url.includes("/media_publish"))!.body).toContain("creation_id=CONTAINER-1");
  });

  it("publishes with the PAGE token, never the system user's", async () => {
    /**
     * 🔑 A post made with the system user's token is refused or attributed
     * wrongly — the same rule as Facebook publishing, and the kind of thing
     * that passes review because both strings look like tokens.
     */
    const g = fakeGraph();
    await publish(g);
    const writes = g.calls.filter((c) => c.method === "POST");
    expect(writes.length).toBeGreaterThan(0);
    for (const c of writes) {
      expect(c.body).toContain(encodeURIComponent(PAGE_TOKEN));
      expect(c.body).not.toContain(encodeURIComponent(SYSTEM_TOKEN));
      expect(c.body).not.toContain(SYSTEM_TOKEN);
    }
  });

  it("puts the caption in the body, not in the URL", async () => {
    // ⚠️ A caption has line breaks and is long, and a URL is a place things
    // get logged — by us, by Vercel, and by anything in between.
    const g = fakeGraph();
    await publish(g, "first line\nsecond line #imotara");
    const media = g.calls.find((c) => c.url.includes("/media") && !c.url.includes("media_publish"))!;
    /**
     * ⚠️ The WORDS, not the parameter name. `toContain("caption=")` passed
     * happily with the caption replaced by an empty string — the post would
     * have gone out as a bare picture and every test stayed green.
     */
    const sent = new URLSearchParams(media.body).get("caption");
    expect(sent).toBe("first line\nsecond line #imotara");
    expect(media.url).not.toContain("caption");
  });
});

describe("a container that fails is not a post that failed quietly", () => {
  it("says the problem is the IMAGE, and publishes nothing", async () => {
    const g = fakeGraph({ status: [{ status_code: "ERROR", status: "Media download failed" }] });
    const r = await publish(g);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    // ▶️ The remedy is the URL, not the token. Saying "permission" here is the
    // difference between a five-minute fix and an afternoon.
    expect(r.message).toMatch(/IMAGE, not the token/);
    expect(r.message).toMatch(/Nothing was published/);
    expect(g.calls.some((c) => c.url.includes("/media_publish"))).toBe(false);
  });

  it("gives up rather than publishing a container that is still being built", async () => {
    // ⛔ media_publish on an IN_PROGRESS container fails with a message about
    // the media, which reads like a broken card.
    const g = fakeGraph({ status: [{ status_code: "IN_PROGRESS" }] });
    const r = await publish(g);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.message).toMatch(/still preparing/);
    expect(g.calls.some((c) => c.url.includes("/media_publish"))).toBe(false);
  });

  it("waits for a container that is slow but fine", async () => {
    const g = fakeGraph({ status: [{ status_code: "IN_PROGRESS" }, { status_code: "FINISHED" }] });
    const r = await publish(g);
    expect(r.ok).toBe(true);
  });

  it("does not call it a success when the publish returns no media id", async () => {
    const g = fakeGraph({ publish: {} });
    const r = await publish(g);
    expect(r.ok).toBe(false);
  });

  it("still succeeds when only the permalink read fails", async () => {
    // ⚠️ The post is already on the timeline. A missing link is a worse admin
    // screen, not a worse outcome — and turning it into a failure would make
    // the publisher retry something already published.
    const g = fakeGraph({ permalink: { error: { code: 100, message: "nope" } } });
    const r = await publish(g);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.url).toContain("instagram.com");
  });
});

describe("a broken link is reported as a broken link", () => {
  it("does not call an unlinked account a dead token", async () => {
    /**
     * ⛔ The 100/33 lesson, again. The token WORKED — it answered. Reporting
     * "re-paste your token" sends somebody to replace a perfectly good
     * credential while the real problem sits in Business settings.
     */
    const g = fakeGraph({ accounts: { data: [{ id: PAGE, name: "Imotara", access_token: PAGE_TOKEN }] } });
    const r = await instagramLink({ token: SYSTEM_TOKEN, igUserId: IG, fetchImpl: g.impl });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.kind).toBe("page");
    expect(r.kind).not.toBe("token");
    expect(r.message).toMatch(/Business or Creator/);
  });

  it("names what it CAN see, so the id can be corrected without guessing", async () => {
    const g = fakeGraph({
      accounts: {
        data: [
          {
            id: PAGE,
            name: "Imotara",
            access_token: PAGE_TOKEN,
            instagram_business_account: { id: "17841999999999999", username: "someoneelse" },
          },
        ],
      },
    });
    const r = await instagramLink({ token: SYSTEM_TOKEN, igUserId: IG, fetchImpl: g.impl });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.message).toContain("someoneelse");
    expect(r.message).toContain("17841999999999999");
  });

  it("picks the Page the account is actually linked to, not the first one", async () => {
    const g = fakeGraph();
    const r = await instagramLink({ token: SYSTEM_TOKEN, igUserId: IG, fetchImpl: g.impl });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.link.pageId).toBe(PAGE);
    expect(r.link.pageToken).toBe(PAGE_TOKEN);
    expect(r.link.pageToken).not.toBe("OTHER-TOKEN");
  });
});

describe("the figures are recorded honestly or not at all", () => {
  it("reads followers from the node", async () => {
    const g = fakeGraph();
    const r = await fetchInstagramStats({ token: SYSTEM_TOKEN, igUserId: IG, fetchImpl: g.impl });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.stats.followers).toBe(81);
  });

  it("stores null rather than zero when a figure is missing", async () => {
    /**
     * ⛔ "We could not ask" and "nobody follows this account" are different
     * facts. A zero here averages into every chart as if it were a reading.
     */
    const g = fakeGraph();
    const impl = (async (u: string | URL, i?: RequestInit) => {
      if (String(u).includes("followers_count")) {
        return { json: async () => ({ username: "imotaraofficial" }) } as unknown as Response;
      }
      return g.impl(u as string, i);
    }) as unknown as typeof fetch;
    const r = await fetchInstagramStats({ token: SYSTEM_TOKEN, igUserId: IG, fetchImpl: impl });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.stats.followers).toBeNull();
    expect(r.stats.followers).not.toBe(0);
  });

  it("does not let a retired metric name swallow a dead token", async () => {
    /**
     * 🔴 THE BUG I SHIPPED ON THE PAGE SIDE. Every candidate metric "failed",
     * the loop moved on, and a (#190) — the token is gone — was reported to
     * the admin as "Reach yesterday: unknown".
     */
    const impl = (async (u: string | URL) => {
      const s = String(u);
      const json = (v: unknown) => ({ json: async () => v }) as unknown as Response;
      if (s.includes("me/accounts")) {
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
      if (s.includes("/insights")) return json({ error: { code: 190, message: "Session has expired" } });
      return json({ like_count: 3, comments_count: 1 });
    }) as unknown as typeof fetch;

    const r = await fetchInstagramPostStats({
      token: SYSTEM_TOKEN,
      igUserId: IG,
      mediaId: "MEDIA-1",
      fetchImpl: impl,
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.kind).toBe("token");
  });

  it("keeps the saves, because saves are what this channel ranks on", async () => {
    const g = fakeGraph();
    const r = await fetchInstagramPostStats({
      token: SYSTEM_TOKEN,
      igUserId: IG,
      mediaId: "MEDIA-1",
      fetchImpl: g.impl,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.stats.saved).toBe(9);
  });
});
