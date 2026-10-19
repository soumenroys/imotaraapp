// src/lib/social/contentMix.ts
// Which SHAPE this post takes, when a schedule makes more than one.
//
// 🔑 THE OWNER, 19 Oct: "randomly mix text+graphics and videos in content."
//
// ⛔ ROTATION, NOT `Math.random()`, and the distinction has bitten this
// project before. A fair coin over two shapes produces four videos in a row
// often enough to be noticed, and "why was it all videos this week?" has no
// answer when the cause is a coin flip. ⇒ The same reasoning that made the
// ANGLE a rotation rather than a choice
// ⇒ trap_a_menu_handed_to_a_model_is_not_a_rotation.
//
// ⚠️ AND THE SAME COUNTER the angle uses — `postsSoFar`. The two cycles have
// different lengths (2 shapes against 5 pools), so they drift against each
// other rather than locking, which is what keeps "video day" from always
// being "privacy day".

import { CONTENT_TYPES, type ContentType } from "@/lib/social/contentTypes";
import { PUBLISHABLE, type MediaKind } from "@/lib/social/mediaPlan";

/**
 * What a shape becomes once it is a post.
 *
 * ⚠️ MUST AGREE WITH `mediaKindFor` in pipeline.ts, which is the thing that
 * actually writes the column. This exists so the CHECK below can be made
 * before a post is written rather than after it cannot publish.
 */
export function kindOfShape(shape: ContentType): MediaKind {
  if (shape === "text") return "none";
  if (shape === "short_video") return "short_video";
  if (shape === "animated_gif") return "animated_gif";
  if (shape === "carousel") return "carousel";
  return "graphic";
}

export type MixProblem = { shape: ContentType; platform: string; why: string };

/**
 * 🔴 A MIX MAY NOT NAME A SHAPE A CHANNEL CANNOT PUBLISH.
 *
 * ⛔ Without this the failure arrives at the far end and looks like nothing:
 * a carousel is written for Facebook, saved, approved, and then held by the
 * publisher on every run forever, because Facebook takes multi-photo posts by
 * a route nothing has been built for ⇒ mediaPlan.ts. The only symptom is a
 * channel that posts every other day ⇒ trap_a_dead_cron_fails_where_nobody_is_watching.
 *
 * ⚠️ Checked against EVERY platform the schedule posts to, not the first one.
 * A schedule carrying both Instagram and Facebook may only rotate through
 * shapes both of them accept.
 */
export function mixProblems(mix: readonly string[], platforms: readonly string[]): MixProblem[] {
  const out: MixProblem[] = [];
  for (const raw of mix) {
    if (!(CONTENT_TYPES as readonly string[]).includes(raw)) {
      out.push({ shape: raw as ContentType, platform: "—", why: `"${raw}" is not a shape this product makes.` });
      continue;
    }
    const shape = raw as ContentType;
    const kind = kindOfShape(shape);
    for (const platform of platforms) {
      const allowed = PUBLISHABLE[platform];
      if (!allowed) {
        out.push({ shape, platform, why: `${platform} is not a channel this product knows.` });
        continue;
      }
      if (!allowed.includes(kind)) {
        out.push({
          shape,
          platform,
          why:
            `${platform} cannot publish a ${shape.replace("_", " ")}. ` +
            `⚠️ A post written as one would be saved, approved, and then held forever.`,
        });
      }
    }
  }
  return out;
}

/**
 * The shape for this post.
 *
 * ⛔ FALLS BACK TO THE SINGLE `contentType` when there is no mix, which is
 * every schedule written before 19 Oct. A null mix must behave exactly as
 * before, or adding a column changes what every existing schedule produces.
 *
 * ⚠️ `postsSoFar` is the count for the run, the same number the angle rotates
 * on. A negative or non-finite value falls back rather than indexing wildly —
 * it has been wrong before, and an exception here stops the day's post.
 */
export function shapeFor(
  schedule: { contentType: ContentType; contentMix?: readonly string[] | null },
  postsSoFar: number,
): ContentType {
  const mix = schedule.contentMix;
  if (!mix || mix.length === 0) return schedule.contentType;

  const known = mix.filter((m): m is ContentType => (CONTENT_TYPES as readonly string[]).includes(m));
  /**
   * ⛔ An unknown entry is SKIPPED, not fatal. The database constraint should
   * have stopped it; if a row gets past that — a restore from before the
   * constraint, a later migration — the day's post is still written.
   */
  if (known.length === 0) return schedule.contentType;

  const i = Number.isFinite(postsSoFar) && postsSoFar >= 0 ? Math.floor(postsSoFar) : 0;
  return known[i % known.length];
}
