// src/lib/social/ensureAnimatedPicture.ts
// The animated picture for one post — made once, kept, reused.
//
// 🔑 OWNER'S DECISION, 21 Oct: "its perfect now" after watching the trial
// with words and narration on it, and option A — YOUTUBE FIRST, then Facebook
// and Instagram after one test. ⇒ ANIMATED_PLATFORMS is the switch, and it
// holds YouTube only until that test has been seen.
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
 * shapes. ⛔ Facebook (4:5) and Instagram (1:1) are NOT here yet: the model
 * makes only 9:16 and 16:9, and how it treats a squarer picture has not been
 * looked at. One test clip first, then the owner decides.
 */
export const ANIMATED_PLATFORMS: Record<string, AnimationAspect> = {
  youtube: "9:16",
};

export const animationPath = (postId: string) => `${postId}/animation.mp4`;

export async function ensureAnimatedPicture(postId: string, platform: string): Promise<Uint8Array | undefined> {
  const aspect = ANIMATED_PLATFORMS[platform];
  if (!aspect) return undefined;

  const db = getSupabaseAdmin();
  const kept = await db.storage.from(CARD_BUCKET).download(animationPath(postId));
  if (kept.data && kept.data.size > 0) return new Uint8Array(await kept.data.arrayBuffer());

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
  return made.mp4;
}
