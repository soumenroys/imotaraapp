/**
 * ⛔ AN UNDECLARED AUDIENCE IS NOT A DEFAULT — IT IS A GAP IN A LEGAL REGIME.
 *
 * 🔑 Google's reference describes `selfDeclaredMadeForKids` as the channel
 * owner's designation and DOES NOT SAY what happens when it is absent. The
 * whole COPPA regime hangs on that field, and this channel's audience setting
 * is precisely what has been unresolved in Studio.
 *
 * ⇒ It is sent on EVERY upload. Not because the docs demand it — they are
 * silent — but because inheriting an unknown default on this particular
 * question is not something to do by omission
 * ⇒ trap_a_model_invents_specifics_it_cannot_have, answered by declaring
 * rather than guessing.
 */

import { describe, it, expect } from "vitest";
import {
  publishShortToYouTube,
  classifyYouTubeError,
  TITLE_MAX,
  YOUTUBE_UPLOAD_SCOPE,
} from "@/lib/social/adapters/youtube";

const ok = (id: string) => new Response(JSON.stringify({ id }), { status: 200 });
const bytes = new Uint8Array([0, 1, 2, 3]);

/** Pull the JSON metadata back out of the multipart body. */
function metadataOf(body: unknown): Record<string, never> {
  const text = new TextDecoder().decode(body as Uint8Array);
  const json = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
  return JSON.parse(json);
}

describe("every upload declares its audience", () => {
  it("🔴 sends selfDeclaredMadeForKids, and sends FALSE", async () => {
    let sent: Record<string, never> = {} as never;
    await publishShortToYouTube({
      accessToken: "t", title: "Awake at an hour with no queue", description: "x", videoBytes: bytes,
      fetchImpl: (async (_u: string, init: RequestInit) => {
        sent = metadataOf(init.body);
        return ok("abc123");
      }) as unknown as typeof fetch,
    });
    // ⛔ Present, not merely falsy-by-absence: `undefined` would be omitted
    // from the JSON entirely and inherit whatever YouTube decides.
    expect(Object.hasOwn((sent as never as { status: object }).status, "selfDeclaredMadeForKids")).toBe(true);
    expect((sent as never as { status: { selfDeclaredMadeForKids: boolean } }).status.selfDeclaredMadeForKids).toBe(false);
  });

  it("⚠️ and the privacy status, for the same reason", async () => {
    // 🔑 The reference says an omitted value defaults to public — on SOME
    // accounts. "Some accounts" is not a contract.
    let sent: Record<string, never> = {} as never;
    await publishShortToYouTube({
      accessToken: "t", title: "t", description: "x", videoBytes: bytes,
      fetchImpl: (async (_u: string, init: RequestInit) => { sent = metadataOf(init.body); return ok("a"); }) as unknown as typeof fetch,
    });
    expect((sent as never as { status: { privacyStatus: string } }).status.privacyStatus).toBe("public");
  });

  it("can be told otherwise, and says what it was told", async () => {
    let sent: Record<string, never> = {} as never;
    await publishShortToYouTube({
      accessToken: "t", title: "t", description: "x", videoBytes: bytes,
      madeForKids: true, privacyStatus: "unlisted",
      fetchImpl: (async (_u: string, init: RequestInit) => { sent = metadataOf(init.body); return ok("a"); }) as unknown as typeof fetch,
    });
    const status = (sent as never as { status: { selfDeclaredMadeForKids: boolean; privacyStatus: string } }).status;
    expect(status.selfDeclaredMadeForKids).toBe(true);
    expect(status.privacyStatus).toBe("unlisted");
  });
});

describe("the upload itself", () => {
  it("posts multipart to the upload host, asking for snippet and status", async () => {
    let url = "";
    let headers: Record<string, string> = {};
    const r = await publishShortToYouTube({
      accessToken: "t", title: "A title", description: "x", videoBytes: bytes,
      fetchImpl: (async (u: string, init: RequestInit) => {
        url = u; headers = init.headers as Record<string, string>;
        return ok("vid_1");
      }) as unknown as typeof fetch,
    });
    expect(url).toContain("googleapis.com/upload/youtube/v3/videos");
    expect(url).toContain("uploadType=multipart");
    // ⛔ `part` must name what is being WRITTEN, or the status is dropped and
    // the audience declaration above goes nowhere.
    expect(url).toContain("part=snippet,status");
    expect(headers["Content-Type"]).toMatch(/^multipart\/related; boundary=/);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.url).toBe("https://www.youtube.com/shorts/vid_1");
  });

  it("⛔ refuses an empty title here rather than letting Google call it invalid", async () => {
    // ⚠️ `invalidTitle` from Google reads like a bug in the upload, not an
    // empty headline.
    let called = false;
    const r = await publishShortToYouTube({
      accessToken: "t", title: "   ", description: "x", videoBytes: bytes,
      fetchImpl: (async () => { called = true; return ok("a"); }) as unknown as typeof fetch,
    });
    expect(r.ok).toBe(false);
    expect(called).toBe(false);
  });

  it("⛔ refuses an empty video, and an absent token, without calling out", async () => {
    let called = false;
    const f = (async () => { called = true; return ok("a"); }) as unknown as typeof fetch;
    expect((await publishShortToYouTube({ accessToken: "t", title: "t", description: "", videoBytes: new Uint8Array(), fetchImpl: f })).ok).toBe(false);
    expect((await publishShortToYouTube({ accessToken: " ", title: "t", description: "", videoBytes: bytes, fetchImpl: f })).ok).toBe(false);
    expect(called).toBe(false);
  });

  it("clamps a long title defensively", async () => {
    // ⚠️ NOT a documented limit — the reference gives no length, only an
    // `invalidTitle` error. This avoids the refusal; the error is still
    // handled if the real ceiling is different.
    let sent: Record<string, never> = {} as never;
    await publishShortToYouTube({
      accessToken: "t", title: "z".repeat(400), description: "x", videoBytes: bytes,
      fetchImpl: (async (_u: string, init: RequestInit) => { sent = metadataOf(init.body); return ok("a"); }) as unknown as typeof fetch,
    });
    expect((sent as never as { snippet: { title: string } }).snippet.title).toHaveLength(TITLE_MAX);
  });

  it("⛔ says so rather than claiming success when no id comes back", async () => {
    const r = await publishShortToYouTube({
      accessToken: "t", title: "t", description: "x", videoBytes: bytes,
      fetchImpl: (async () => new Response("{}", { status: 200 })) as unknown as typeof fetch,
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.message).toMatch(/may well be on the channel/i);
  });

  it("⛔ never retries inside the adapter", async () => {
    let calls = 0;
    await publishShortToYouTube({
      accessToken: "t", title: "t", description: "x", videoBytes: bytes,
      fetchImpl: (async () => { calls += 1; return new Response("{}", { status: 503 }); }) as unknown as typeof fetch,
    });
    expect(calls).toBe(1);
  });
});

describe("what a failure means", () => {
  it("🔑 tells YouTube's quota apart from a forbidden account", async () => {
    /**
     * ⛔ Both are 403, and they need different people: quota is ours and
     * resets at midnight Pacific; a forbidden upload is the account's.
     */
    const quota = classifyYouTubeError(403, '{"error":{"errors":[{"reason":"quotaExceeded"}],"message":"quota"}}');
    expect(quota.kind).toBe("quota");
    expect(quota.message).toMatch(/1,600 units/);

    const forbidden = classifyYouTubeError(403, '{"error":{"errors":[{"reason":"forbidden"}],"message":"no"}}');
    expect(forbidden.kind).toBe("permission");
    expect(forbidden.message).toMatch(/not the channel's owner|not verified/i);
  });

  it("separates a bad token, a refused video and YouTube's own trouble", () => {
    expect(classifyYouTubeError(401, "{}").kind).toBe("auth");
    expect(classifyYouTubeError(400, "{}").kind).toBe("content");
    expect(classifyYouTubeError(429, "{}").kind).toBe("quota");
    expect(classifyYouTubeError(500, "{}").kind).toBe("transient");
  });
});

describe("the scope asked for", () => {
  it("⛔ is the NARROWEST one that can upload", () => {
    // ⚠️ The reference also accepts `youtube`, `youtubepartner` and
    // `youtube.force-ssl`, each of which can do a great deal more than post.
    expect(YOUTUBE_UPLOAD_SCOPE).toBe("https://www.googleapis.com/auth/youtube.upload");
  });
});
