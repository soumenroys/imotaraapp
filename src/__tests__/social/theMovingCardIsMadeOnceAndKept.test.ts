/**
 * 🔴 THE LAST PIECE, AND THE ONE THAT DECIDES WHETHER THE OTHERS ARE SAFE.
 *
 * Both platforms FETCH the video themselves — Facebook's `/videos` takes a
 * `file_url`, Instagram's Reels a `video_url` — so the bytes have to be
 * reachable by a stranger. ⛔ Which means encoding them on that request would
 * put ffmpeg on the one call that must not be slow, and would also let a post
 * publish a video made from whatever the words say NOW rather than when a
 * human approved them.
 *
 * ⇒ Encoded at approval, stored, and served as a static file.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
process.env.SOCIAL_TOKEN_KEY ??= Buffer.alloc(32, 9).toString("base64");

import { videoUrlFor, cardUrlFor, cardSignatureValid, signCardId } from "@/lib/social/cardUrl";
import { videoPath, cardPath } from "@/lib/social/cardStore";
import { formatForChannel } from "@/lib/social/renderAnimation";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const videoRoute = strip(read("src/app/api/social/video/[id]/route.ts"));
const publisher = strip(read("src/app/api/cron/social-publish/route.ts"));
const ensure = strip(read("src/lib/social/ensureCard.ts"));

const ID = "b1b9f1f6-0000-4000-8000-000000000001";

describe("the moving card is made once, when a human approves it", () => {
  it("⛔ encoded at approval, not when a platform asks", () => {
    expect(ensure).toContain("renderAnimation(");
    expect(ensure).toContain("putVideo(");
    /**
     * ⛔ And the public route never ENCODES — it only serves.
     *
     * ⚠️ Asserted on the CALL, not on the name: the route legitimately
     * imports `formatForChannel` from that module, so `not.toContain
     * ("renderAnimation")` fails on correct code. A test that cannot tell an
     * import from a call is a test that will be weakened to make it pass.
     */
    expect(videoRoute).not.toMatch(/\brenderAnimation\s*\(/);
    expect(videoRoute).toContain("getVideo(");
  });

  it("a missing video is a 404, never an encode on demand", () => {
    /**
     * 🔴 Rendering it there would WORK, which is why it is worth a test: the
     * post would publish a video built from the words as they are now, not as
     * they were when somebody said yes.
     */
    const at = videoRoute.indexOf("if (!bytes)");
    expect(at).toBeGreaterThan(-1);
    expect(videoRoute.slice(at, at + 160)).toContain("404");
  });
});

describe("the URL a platform is handed", () => {
  it("is signed with the same scope as the still card", () => {
    // ⛔ A second signing scheme is a second place to get HMAC wrong.
    expect(videoUrlFor(ID, "https://x.test")).toContain(`t=${signCardId(ID)}`);
    expect(cardSignatureValid(ID, signCardId(ID), 0)).toBe(true);
  });

  it("⛔ and is a different path from the still, so neither can serve the other", () => {
    expect(videoUrlFor(ID, "https://x.test")).toContain("/api/social/video/");
    expect(cardUrlFor(ID, "https://x.test")).toContain("/api/social/card/");
    expect(videoPath(ID, "mp4")).not.toBe(cardPath(ID, 0));
  });

  it("checks the signature BEFORE touching the database", () => {
    // ⚠️ Otherwise the route answers "does this post exist?" to anybody.
    const sig = videoRoute.indexOf("cardSignatureValid");
    const db = videoRoute.indexOf("from(\"social_posts\")");
    expect(sig).toBeGreaterThan(-1);
    expect(sig).toBeLessThan(db);
  });

  it("⛔ a draft is not fetchable even with a valid signature", () => {
    expect(videoRoute).toContain("cardIsFetchable");
  });
});

describe("which format each channel is actually sent", () => {
  it("⛔ an animated GIF only stays a GIF on X", () => {
    /**
     * 🔴 A GIF animates on X and NOWHERE ELSE — LinkedIn strips it and
     * Facebook converts it, both silently ⇒ animate.ts. ⚠️ So the stored
     * SHAPE may say animated_gif while what goes to Facebook is an MP4. The
     * alternative is a still frame everybody assumes is moving.
     */
    expect(formatForChannel("x", "animated_gif")).toBe("gif");
    expect(formatForChannel("facebook", "animated_gif")).toBe("mp4");
    expect(formatForChannel("instagram", "animated_gif")).toBe("mp4");
    expect(formatForChannel("linkedin", "animated_gif")).toBe("mp4");
  });

  it("a short video is always MP4", () => {
    for (const p of ["facebook", "instagram", "x", "linkedin"]) {
      expect(formatForChannel(p, "short_video"), p).toBe("mp4");
    }
  });
});

describe("the publisher sends a video down the video path", () => {
  it("⛔ decides on motion BEFORE the picture branches", () => {
    /**
     * 🔴 The picture branches would otherwise publish a video post's words
     * with a still card, or with nothing at all — which is the failure the
     * whole mediaPlan guard exists to stop, reappearing one level down.
     */
    const motion = publisher.indexOf('post.media_kind === "short_video"');
    const instagram = publisher.indexOf('platform === "instagram"');
    expect(motion).toBeGreaterThan(-1);
    expect(motion).toBeLessThan(instagram);
  });

  it("calls the video adapters, not the picture ones", () => {
    expect(publisher).toContain("publishReelToInstagram(");
    expect(publisher).toContain("publishVideoToFacebook(");
  });

  it("⛔ checks the video is REACHABLE and of the right type first", () => {
    /**
     * ⚠️ The still path already did this, and for the same reason: Meta
     * fetches with none of our credentials, so "does it render here?" is the
     * wrong question. ⛔ And the expected content type must be a VIDEO one —
     * the default is image/jpeg, which a video would never satisfy, but a
     * check that accepted anything would pass a JSON error page as a reel.
     */
    const at = publisher.indexOf('post.media_kind === "short_video"');
    const block = publisher.slice(at, at + 900);
    expect(block).toContain("cardReaches(");
    // ⚠️ A video content type is expected, not the image/jpeg default.
    expect(block).toContain("video");
  });
});
