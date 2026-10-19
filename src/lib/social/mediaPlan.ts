// src/lib/social/mediaPlan.ts
// May this post publish on this channel at all, given what it is made of?
//
// 🔴 THE HOLE THIS CLOSES, FOUND 19 Oct BY TRACING RATHER THAN ASSUMING.
//
// The publisher rendered a picture `if (media_kind === "graphic")` and then
// published whatever it had. Every OTHER kind fell through that `if` with no
// media and no complaint — so a `short_video` post would have gone out on
// Facebook as BARE TEXT, under the brand's name, with the video it was
// written around simply absent. Nothing would have logged, warned or failed.
//
// ⚠️ THE SHAPES EXIST AND THE PUBLISH PATHS DO NOT. animate.ts encodes MP4
// and GIF, the admin previews them, the schedule form offers them — and no
// adapter has ever called Facebook's /videos or Instagram's Reels flow. A
// feature half-built is not dangerous; a feature half-built that FAILS OPEN
// is ⇒ ux_degradation_audit, where three silent degradations were the whole
// finding.
//
// 🔑 ONE FUNCTION, BOTH BRANCHES. The Instagram branch already refused
// anything without a card; Facebook's did not. Two places answering "can this
// publish?" is how they came to disagree in the first place.

/** What the post is made of, as stored on `social_posts.media_kind`. */
export type MediaKind = "none" | "graphic" | "carousel" | "animated_gif" | "short_video";

export type MediaPlan =
  | { ok: true }
  | { ok: false; why: string };

/**
 * ⚠️ WHAT EACH CHANNEL CAN ACTUALLY BE HANDED TODAY — not what it supports.
 *
 * ⛔ Facebook takes video perfectly well; we have never written the call. The
 * honest list is the one that matches the code, because a list that matches
 * the platform's capabilities would let a post through to a path that does
 * not exist.
 */
const PUBLISHABLE: Record<string, MediaKind[]> = {
  // Text, or a card rendered from the recipe ⇒ publishToFacebook takes bytes.
  facebook: ["none", "graphic"],
  // ⛔ No text-only post exists here, so "none" is absent on purpose.
  instagram: ["graphic", "carousel"],
  linkedin: ["none", "graphic"],
  x: ["none", "graphic"],
  youtube: [],
};

/**
 * 🔑 WHY A POST IS HELD, in words a person can act on.
 *
 * ⛔ Held, never downgraded. Publishing a video post as text is not a
 * degraded version of the post — it is a different post, one nobody wrote
 * and nobody approved.
 */
export function mediaPlan(platform: string, mediaKind: string | null): MediaPlan {
  const allowed = PUBLISHABLE[platform];

  if (!allowed) {
    return { ok: false, why: `There is no publish path for ${platform} at all.` };
  }

  const kind = (mediaKind ?? "none") as MediaKind;
  if (allowed.includes(kind)) return { ok: true };

  if (kind === "animated_gif" || kind === "short_video") {
    return {
      ok: false,
      why:
        `This post is a ${kind === "short_video" ? "short video" : "animated GIF"}, and nothing ` +
        `here can publish one yet. ⚠️ The frames and the encoder exist ⇒ animate.ts, and the ` +
        `admin can preview it — what is missing is the call to the platform. ` +
        `⛔ It is HELD rather than published as plain text: a video post without its video is ` +
        `not a lesser version of the post, it is a different one that nobody approved. ` +
        `▶️ Change the schedule's shape, or the post, to a graphic.`,
    };
  }

  if (kind === "carousel") {
    return {
      ok: false,
      why:
        `This post is a carousel, which only Instagram can publish here. ⚠️ ${platform} takes ` +
        `multi-photo posts by a different route and nothing has been built for it. ` +
        `▶️ Give this channel its own schedule with a single-card shape ⇒ one schedule per channel.`,
    };
  }

  return {
    ok: false,
    why: `${platform} cannot publish a post of kind "${kind}". ⛔ Held rather than sent without it.`,
  };
}
