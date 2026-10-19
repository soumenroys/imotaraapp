/**
 * ⛔ ON X, A POST IS A PURCHASE.
 *
 * 🔑 THE OWNER CHOSE PAY-PER-USE, 19 Oct 2026. The free tier is gone and both
 * subscription plans are closed to new signups, so every post is metered and
 * credits are bought up front.
 *
 * 💰 THE FIELD THAT COSTS THIRTEEN TIMES. The reported rate card is $0.015 to
 * create a post and **$0.200 if the post contains a URL** — ~45¢ a month
 * against ~$6, decided by `linksInBody`. ⚠️ Those figures are not from X;
 * developer.x.com answers a fetch with 402. Several independent sources agree,
 * and that is all ⇒ trap_a_model_invents_specifics_it_cannot_have.
 *
 * 🔴 THE ENDPOINTS, BY CONTRAST, ARE FROM X'S OWN DOCS — and they contradict
 * every 2026-dated guide found by searching, which still say to upload media
 * to `upload.twitter.com/1.1/media/upload.json`. X's documentation does not
 * mention v1.1 at all.
 */

import { describe, it, expect } from "vitest";
import { publishToX, uploadXMedia, classifyXError, X_MAX_CHARACTERS } from "@/lib/social/adapters/x";
import { PLATFORMS } from "@/lib/social/platforms";

const bytes = new Uint8Array([1, 2, 3, 4]);
const posted = (id: string) => new Response(JSON.stringify({ data: { id } }), { status: 200 });

describe("the field that costs thirteen times", () => {
  it("🔴 X keeps links OUT of the body, like every other channel", () => {
    expect(PLATFORMS.x.linksInBody).toBe(false);
    // 🔑 The destination still has somewhere to live.
    expect(PLATFORMS.x.qr).toBe(true);
  });

  it("⚠️ every channel that PENALISES a link keeps it out of the body", () => {
    /**
     * 🔴 MY FIRST VERSION OF THIS WAS TOO STRONG and the suite caught it. It
     * said no channel may carry QR codes AND a link — and YouTube does both,
     * deliberately: "These are people who already subscribed. A link is a
     * service to them, not a leak of reach." ⇒ platforms.ts.
     *
     * 🔑 The real rule is narrower. Where a link costs REACH (Facebook,
     * LinkedIn), buys NOTHING (Instagram does not make it clickable) or costs
     * MONEY (X charges 13× for a post containing one), it stays out of the
     * body. YouTube is the one channel where none of those is true.
     */
    for (const id of ["facebook", "linkedin", "instagram", "x"] as const) {
      expect(PLATFORMS[id].linksInBody, `${id} puts a link in the body`).toBe(false);
    }
    // ⚠️ Pinned as the deliberate exception, so flipping it is a decision
    // somebody makes rather than a drift nobody notices.
    expect(PLATFORMS.youtube.linksInBody, "YouTube's exception was removed silently").toBe(true);
  });
});

describe("posting", () => {
  it("posts to /2/tweets, and returns a readable link", async () => {
    let url = "";
    let body = "";
    const r = await publishToX({
      token: "t",
      text: "There is a stretch of the night when nobody answers.",
      fetchImpl: (async (u: string, init: RequestInit) => { url = u; body = String(init.body); return posted("1880"); }) as unknown as typeof fetch,
    });
    expect(url).toBe("https://api.x.com/2/tweets");
    expect(JSON.parse(body).text).toMatch(/stretch of the night/);
    expect(JSON.parse(body).media, "a text-only post sent an empty media object").toBeUndefined();
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.url).toBe("https://x.com/imotaraofficial/status/1880");
  });

  it("attaches the card when there is one", async () => {
    let body = "";
    await publishToX({
      token: "t", text: "x", mediaId: "media_1",
      fetchImpl: (async (_u: string, init: RequestInit) => { body = String(init.body); return posted("1"); }) as unknown as typeof fetch,
    });
    expect(JSON.parse(body).media).toEqual({ media_ids: ["media_1"] });
  });

  it("🔴 refuses an over-length post WITHOUT calling X, because a call costs money", async () => {
    /**
     * ⛔ Over the limit X answers with a generic error — and under
     * pay-per-use a refused call may still be a call. The gate already holds
     * posts well under this; here it is the backstop.
     */
    let called = false;
    const r = await publishToX({
      token: "t", text: "z".repeat(X_MAX_CHARACTERS + 1),
      fetchImpl: (async () => { called = true; return posted("1"); }) as unknown as typeof fetch,
    });
    expect(r.ok).toBe(false);
    expect(called, "it paid to be told the post was too long").toBe(false);
    if (r.ok) return;
    expect(r.message).toMatch(/Nothing was sent/);
  });

  it("⛔ counts CHARACTERS, not bytes — an emoji is not three letters", async () => {
    // ⚠️ `.length` on a string with astral characters over-counts and would
    // refuse a post X would have accepted.
    const text = "🙂".repeat(140); // 140 characters, 280 UTF-16 units
    let called = false;
    await publishToX({
      token: "t", text,
      fetchImpl: (async () => { called = true; return posted("1"); }) as unknown as typeof fetch,
    });
    expect(called, "a 140-character post was refused as too long").toBe(true);
  });

  it("⛔ never retries, because here a retry is a second charge", async () => {
    let calls = 0;
    await publishToX({
      token: "t", text: "x",
      fetchImpl: (async () => { calls += 1; return new Response("{}", { status: 503 }); }) as unknown as typeof fetch,
    });
    expect(calls).toBe(1);
  });

  it("⚠️ warns that a post with no id back may be live AND paid for", async () => {
    const r = await publishToX({
      token: "t", text: "x",
      fetchImpl: (async () => new Response("{}", { status: 200 })) as unknown as typeof fetch,
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.message).toMatch(/paid for/);
  });
});

describe("uploading the card", () => {
  it("🔴 uses X's v2 flow, NOT the v1.1 endpoint the guides still name", async () => {
    const urls: string[] = [];
    const r = await uploadXMedia({
      token: "t", bytes,
      fetchImpl: (async (u: string) => {
        urls.push(u);
        if (u.endsWith("/initialize")) return new Response(JSON.stringify({ data: { id: "m1" } }), { status: 200 });
        return new Response("{}", { status: 200 });
      }) as unknown as typeof fetch,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.mediaId).toBe("m1");
    expect(urls).toEqual([
      "https://api.x.com/2/media/upload/initialize",
      "https://api.x.com/2/media/upload/m1/append",
      "https://api.x.com/2/media/upload/m1/finalize",
    ]);
    expect(urls.join(" "), "the dead v1.1 endpoint was used").not.toMatch(/upload\.twitter\.com|1\.1/);
  });

  it("⚠️ initialize is JSON and declares the category — the other two are not", async () => {
    // 🔑 X's docs call this out: "Send a JSON body — not multipart form
    // fields" — on the one step of three where that is true.
    let init: RequestInit | undefined;
    await uploadXMedia({
      token: "t", bytes,
      fetchImpl: (async (u: string, i: RequestInit) => {
        if (u.endsWith("/initialize")) { init = i; return new Response(JSON.stringify({ data: { id: "m1" } }), { status: 200 }); }
        return new Response("{}", { status: 200 });
      }) as unknown as typeof fetch,
    });
    const body = JSON.parse(String(init!.body));
    expect(body.media_category).toBe("tweet_image");
    expect(body.total_bytes).toBe(bytes.byteLength);
    expect((init!.headers as Record<string, string>)["Content-Type"]).toBe("application/json");
  });

  it("⛔ does not call X at all with no bytes", async () => {
    let called = false;
    const r = await uploadXMedia({
      token: "t", bytes: new Uint8Array(),
      fetchImpl: (async () => { called = true; return new Response("{}", { status: 200 }); }) as unknown as typeof fetch,
    });
    expect(r.ok).toBe(false);
    expect(called).toBe(false);
  });
});

describe("what a failure means, when posting costs money", () => {
  it("🔴 tells an EMPTY WALLET apart from a forbidden token", () => {
    /**
     * ⛔ Both are 403, and under pay-per-use the first is now common. A
     * message saying "forbidden" would send somebody to regenerate a token
     * when the fix is a payment.
     */
    const broke = classifyXError(403, '{"title":"Forbidden","detail":"insufficient credit balance"}');
    expect(broke.kind).toBe("billing");
    expect(broke.message).toMatch(/bought UP FRONT/);

    expect(classifyXError(403, '{"title":"Forbidden","detail":"not allowed"}').kind).toBe("permission");
  });

  it("reads 402 as money, which is what it is", () => {
    expect(classifyXError(402, '{"detail":"payment required"}').kind).toBe("billing");
  });

  it("separates a bad token, a refused post and X's own trouble", () => {
    expect(classifyXError(401, "{}").kind).toBe("auth");
    expect(classifyXError(400, "{}").kind).toBe("content");
    expect(classifyXError(429, "{}").kind).toBe("rate");
    expect(classifyXError(503, "{}").kind).toBe("transient");
  });
});
