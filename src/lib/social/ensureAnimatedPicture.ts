// src/lib/social/ensureAnimatedPicture.ts
// The animated picture for one post — made once, kept, reused.
//
// 🔑 OWNER'S DECISION, 21 Oct: "its perfect now" after watching the trial
// with words and narration on it, and option A — YOUTUBE FIRST, then Facebook
// and Instagram after one test. ⇒ ANIMATED_PLATFORMS is the switch. The
// Facebook test was seen the same day and both were switched on.
//
// ⚠️ MADE AT APPROVAL, NOT AT QUEUE TIME, so only an approved post costs
// money (~$0.10 per second at 720p) — a rejected draft never pays for a clip.
//
// ⚠️ KEPT BESIDE THE POST as animation.mp4, so a re-render — a font fix, a
// layout fix — reuses the clip instead of paying for a new one that would
// also move differently from the approved video.
//
// ⛔ EVERY FAILURE RETURNS undefined, and the caller then encodes the still
// picture exactly as before. A post must never fail approval, or go out as
// words over nothing, because a video model was busy.

import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { CARD_BUCKET, getIllustration } from "@/lib/social/cardStore";
import { animatePicture, type AnimationAspect } from "@/lib/social/animatePicture";

/**
 * 🔑 Which channels get an animated picture, and in which of the model's two
 * shapes.
 *
 * ⚠️ The model makes only 9:16 and 16:9. Facebook (4:5) and Instagram (1:1)
 * take the 9:16 clip trimmed to their shape — the Facebook test of 21 Oct
 * showed the drawing slightly zoomed with its top edge cut, and the owner
 * accepted that and switched both on the same day. 9:16 rather than 16:9
 * because both shapes are nearer portrait, so less of the picture is lost.
 */
export const ANIMATED_PLATFORMS: Record<string, AnimationAspect> = {
  youtube: "9:16",
  facebook: "9:16",
  instagram: "9:16",
};

export const animationPath = (postId: string) => `${postId}/animation.mp4`;

/**
 * 💰 OWNER, 10 Nov 2026 (#116): "make them once in two weeks". The animated
 * clips were ₹2,333 of the ₹3,923 Google AI bill over 90 days, made on every
 * approved video post. Now ONE new clip per 14 days across all channels; every
 * other video post gets the still-picture video (our own camera move, no
 * generated motion), exactly as when the model fails.
 *
 * 🔑 The date of the last clip lives in `app_settings` (key/value, already
 * used live by the IndexNow cron) — ⛔ NOT as a file in the card bucket: that
 * bucket accepts only gif/jpeg/mp4, so a JSON marker would be refused and the
 * limit would silently never apply. ⚠️ A clip already kept beside a post is
 * still reused on a re-render — the limit is on MAKING clips, not on using them.
 */
export const ANIMATION_EVERY_MS = 14 * 24 * 60 * 60 * 1000;
export const LAST_ANIMATION_KEY = "social_last_animation";

export async function ensureAnimatedPicture(postId: string, platform: string): Promise<Uint8Array | undefined> {
  const aspect = ANIMATED_PLATFORMS[platform];
  if (!aspect) return undefined;

  const db = getSupabaseAdmin();
  const kept = await db.storage.from(CARD_BUCKET).download(animationPath(postId));
  if (kept.data && kept.data.size > 0) return new Uint8Array(await kept.data.arrayBuffer());

  const { data: last } = await db.from("app_settings").select("value").eq("key", LAST_ANIMATION_KEY).maybeSingle();
  const lastAt = (last?.value as { at?: unknown } | null | undefined)?.at;
  const madeAt = typeof lastAt === "string" ? Date.parse(lastAt) : NaN;
  if (Number.isFinite(madeAt) && Date.now() - madeAt < ANIMATION_EVERY_MS) {
    console.log("[ensureAnimatedPicture] still picture — last clip was made under 14 days ago", { postId, lastClipAt: lastAt });
    return undefined;
  }

  const picture = await getIllustration(postId);
  if (!picture) return undefined;

  const made = await animatePicture(picture, { aspect });
  if (!made.ok) {
    console.error("[ensureAnimatedPicture] no clip, the still picture will be used", { postId, error: made.error });
    return undefined;
  }

  const { error } = await db.storage
    .from(CARD_BUCKET)
    .upload(animationPath(postId), made.mp4, { contentType: "video/mp4", upsert: true });
  if (error) console.error("[ensureAnimatedPicture] the clip could not be kept", { postId, error: error.message });

  // ⚠️ Written after a clip was PAID FOR, kept or not — the money is spent either way.
  const now = new Date().toISOString();
  const { error: markError } = await db
    .from("app_settings")
    .upsert({ key: LAST_ANIMATION_KEY, value: { at: now, postId }, updated_at: now }, { onConflict: "key" });
  if (markError) console.error("[ensureAnimatedPicture] the clip date could not be kept", { postId, error: markError.message });
  return made.mp4;
}
