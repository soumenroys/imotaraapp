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
export const PUBLISHABLE: Record<string, MediaKind[]> = {
  /**
   * ⚠️ MOTION ADDED 19 Oct, once BOTH halves existed: the adapter that calls
   * the platform AND the stored bytes for it to fetch
   * ⇒ publishVideoToFacebook, /api/social/video/[id], ensureCard.
   *
   * ⛔ This list has always matched THE CODE rather than the platform, and
   * that is what kept a video post from going out as bare text for the weeks
   * the shapes existed and the calls did not.
   */
  facebook: ["none", "graphic", "short_video", "animated_gif"],
  // ⛔ No text-only post exists here, so "none" is absent on purpose.
  instagram: ["graphic", "carousel", "short_video", "animated_gif"],
  // ⚠️ Still held: no adapter calls either of these channels for video.
  linkedin: ["none", "graphic"],
  x: ["none", "graphic"],
  /**
   * 🔴 ONE SHAPE, AND THE LIST WAS EMPTY UNTIL 19 Oct.
   *
   * ⛔ A Short IS a video — there is no still-image or text post on this
   * channel, so "none", "graphic" and "carousel" are absent because YouTube
   * cannot be handed them, not because we have not got round to it.
   *
   * ⚠️ `animated_gif` IS DELIBERATELY ABSENT TOO. The publisher's motion
   * branch covers short_video AND animated_gif together, so listing it here
   * would send a GIF to `videos.insert` and let Google refuse it at 19:30.
   * Held early, with a reason, beats refused late.
   *
   * 🔑 AND WHY THIS LINE MATTERS MORE THAN IT LOOKS: `canPublish` was flipped
   * to true in platforms.ts in the same change, and with this list still empty
   * every YouTube post would have been written, approved, and then held here —
   * one layer below where anybody would have gone looking
   * ⇒ trap_a_constraint_nobody_told_the_writer.
   */
  youtube: ["short_video"],
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
