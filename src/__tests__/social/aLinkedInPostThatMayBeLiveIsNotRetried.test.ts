/**
 * 🔴 ON LINKEDIN, "IT FAILED" AND "WE DON'T KNOW" COME BACK WITH ONE WORD.
 *
 * The adapter calls a dropped connection, a 5xx and a 201 with no
 * `x-restli-id` all `transient` — and each of those may have left a live post.
 * The publisher's rule for that case is keyed on `network` ("unverified: look
 * before re-approving"). ⇒ postToLinkedIn maps the POST call's `transient` to
 * `network`, and only the post call's: an upload that failed made no post.
 *
 * ⛔ And a post meant to carry a card never goes out without it.
 */

import { describe, it, expect } from "vitest";
import { postToLinkedIn } from "@/lib/social/linkedinPost";

type Call = { url: string; method: string; body?: string };

function fakeLinkedIn(opts: { post: () => Response; imageStatus?: string; uploadInit?: () => Response }) {
  const calls: Call[] = [];
  const fetchImpl = (async (url: string, init?: RequestInit) => {
    const u = String(url);
    calls.push({ url: u, method: init?.method ?? "GET", body: typeof init?.body === "string" ? init.body : undefined });
    if (u.includes("/rest/images?action=initializeUpload")) {
      return opts.uploadInit
        ? opts.uploadInit()
        : new Response(JSON.stringify({ value: { uploadUrl: "https://api.linkedin.com/mediaUpload/C1", image: "urn:li:image:C1" } }), { status: 200 });
    }
    if (u.startsWith("https://api.linkedin.com/mediaUpload/")) return new Response("", { status: 201 });
    if (u.includes("/rest/images/")) {
      return new Response(JSON.stringify({ status: opts.imageStatus ?? "AVAILABLE" }), { status: 200 });
    }
    if (u.endsWith("/rest/posts")) return opts.post();
    throw new Error(`unexpected call ${u}`);
  }) as unknown as typeof fetch;
  return { calls, fetchImpl };
}

const base = { token: "t", organizationId: "115173947", text: "A quiet thing (said plainly).", waitMs: async () => {} };
const created = () => new Response("", { status: 201, headers: { "x-restli-id": "urn:li:share:7" } });

describe("postToLinkedIn", () => {
  it("uploads the card, waits for it, and posts it with the headline as alt text", async () => {
    const li = fakeLinkedIn({ post: created });
    const r = await postToLinkedIn({ ...base, picture: new Uint8Array([1, 2, 3]), altText: "The headline", fetchImpl: li.fetchImpl });

    expect(r).toEqual({ ok: true, postId: "urn:li:share:7", url: "https://www.linkedin.com/feed/update/urn:li:share:7/" });
    const post = li.calls.find((c) => c.url.endsWith("/rest/posts"))!;
    const sent = JSON.parse(post.body!);
    expect(sent.author).toBe("urn:li:organization:115173947");
    expect(sent.content.media).toEqual({ id: "urn:li:image:C1", altText: "The headline" });
    // ⚠️ The post comes LAST — after the image was seen AVAILABLE.
    expect(li.calls.at(-1)!.url).toMatch(/\/rest\/posts$/);
  });

  it("posts text alone when the post has no card", async () => {
    const li = fakeLinkedIn({ post: created });
    const r = await postToLinkedIn({ ...base, fetchImpl: li.fetchImpl });
    expect(r.ok).toBe(true);
    expect(li.calls.map((c) => c.url)).toEqual(["https://api.linkedin.com/rest/posts"]);
    expect(JSON.parse(li.calls[0].body!).content).toBeUndefined();
  });

  it("⛔ a card LinkedIn could not process means NO post call at all", async () => {
    const li = fakeLinkedIn({ post: created, imageStatus: "PROCESSING_FAILED" });
    const r = await postToLinkedIn({ ...base, picture: new Uint8Array([1]), fetchImpl: li.fetchImpl });
    expect(r.ok).toBe(false);
    expect(li.calls.some((c) => c.url.endsWith("/rest/posts"))).toBe(false);
  });

  it("an upload that LinkedIn's end dropped is a plain failure — no post was made", async () => {
    const li = fakeLinkedIn({ post: created, uploadInit: () => new Response("busy", { status: 503 }) });
    const r = await postToLinkedIn({ ...base, picture: new Uint8Array([1]), fetchImpl: li.fetchImpl });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.kind).not.toBe("network");
    expect(li.calls.some((c) => c.url.endsWith("/rest/posts"))).toBe(false);
  });

  it("🔴 a 5xx on the POST call is UNVERIFIED — the post may be live", async () => {
    const li = fakeLinkedIn({ post: () => new Response("oops", { status: 502 }) });
    const r = await postToLinkedIn({ ...base, fetchImpl: li.fetchImpl });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.kind).toBe("network");
  });

  it("🔴 a 201 with no post id is UNVERIFIED too — LinkedIn accepted something", async () => {
    const li = fakeLinkedIn({ post: () => new Response("", { status: 201 }) });
    const r = await postToLinkedIn({ ...base, fetchImpl: li.fetchImpl });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.kind).toBe("network");
  });

  it("a refused token stays a refused token", async () => {
    const li = fakeLinkedIn({ post: () => new Response('{"message":"Invalid access token","serviceErrorCode":65600}', { status: 401 }) });
    const r = await postToLinkedIn({ ...base, fetchImpl: li.fetchImpl });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.kind).toBe("auth");
  });
});
