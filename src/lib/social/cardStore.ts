// src/lib/social/cardStore.ts
// Keeping and fetching a card that cannot be drawn on demand.
//
// ⚠️ ONLY for the scripts Satori cannot shape ⇒ docs/sql/social_card_store.sql.
// Every other card is still derived from its recipe at fetch time, and that
// rule is not being abandoned — it simply buys nothing for a language that
// cannot produce a picture at all.

import { getSupabaseAdmin } from "@/lib/supabaseServer";

export const CARD_BUCKET = "social-cards";

/**
 * Where one card lives.
 *
 * 🔑 THE SLIDE IS IN THE PATH. A carousel is several cards for one post, and
 * a path that ignored the slide would have each card overwrite the last —
 * leaving a carousel of the same picture, which looks deliberate.
 *
 * ⚠️ `.jpg` because the bucket only accepts image/jpeg, which is itself
 * because Instagram rejects PNG.
 */
export function cardPath(postId: string, slide = 0): string {
  return `${postId}/${slide}.jpg`;
}

/**
 * Where a post's moving card lives.
 *
 * 🔑 ENCODED ONCE, AT APPROVAL, AND KEPT — for the same reason the shaped
 * cards are. Meta FETCHES this URL itself before it publishes, and encoding
 * five frames plus an MP4 on that request would put ffmpeg on the one call
 * that must not be slow ⇒ docs/sql/social_card_store.sql.
 *
 * ⚠️ The extension follows the format, because the bucket and the browser
 * both decide what they are looking at from it.
 */
export function videoPath(postId: string, format: "mp4" | "gif"): string {
  return `${postId}/motion.${format}`;
}

/**
 * Put the bytes where the card route can find them.
 *
 * ⛔ `upsert: true`. A post can be edited and re-approved, and the second
 * render must REPLACE the first — otherwise the reviewer approves new words
 * and the old picture publishes.
 */
/** Keep a post's moving card. ⚠️ Same upsert rule as a still: a re-approval
 *  must REPLACE, or new words publish over an old picture. */
export async function putVideo(
  postId: string,
  format: "mp4" | "gif",
  bytes: Uint8Array,
): Promise<{ ok: true; path: string } | { ok: false; error: string }> {
  const db = getSupabaseAdmin();
  const path = videoPath(postId, format);
  const { error } = await db.storage.from(CARD_BUCKET).upload(path, bytes, {
    contentType: format === "mp4" ? "video/mp4" : "image/gif",
    upsert: true,
  });
  if (error) return { ok: false, error: `The video could not be stored: ${error.message}` };
  return { ok: true, path };
}

/** The stored video, or nothing. ⛔ Unlike a still, there is NO fallback to
 *  rendering it on demand — that is the whole reason it is stored. */
export async function getVideo(postId: string, format: "mp4" | "gif"): Promise<Uint8Array | null> {
  const db = getSupabaseAdmin();
  const { data, error } = await db.storage.from(CARD_BUCKET).download(videoPath(postId, format));
  if (error || !data) return null;
  return new Uint8Array(await data.arrayBuffer());
}

export async function putCard(
  postId: string,
  slide: number,
  bytes: Uint8Array,
): Promise<{ ok: true; path: string } | { ok: false; error: string }> {
  const db = getSupabaseAdmin();
  const path = cardPath(postId, slide);
  const { error } = await db.storage
    .from(CARD_BUCKET)
    .upload(path, bytes, { contentType: "image/jpeg", upsert: true });

  if (error) return { ok: false, error: `The card could not be stored: ${error.message}` };
  return { ok: true, path };
}

/**
 * The stored bytes, or nothing.
 *
 * ⛔ RETURNS NULL RATHER THAN THROWING, and the caller falls back to drawing
 * the card. A storage hiccup must degrade to "render it now", never to a
 * failed fetch — because the thing fetching is Instagram, and a failure there
 * is a post that does not go out.
 *
 * ⚠️ But a MISSING card for a script that cannot be drawn is not recoverable
 * by falling back, and the renderer will say so in its own words.
 */
export async function getCard(postId: string, slide = 0): Promise<Uint8Array | null> {
  const db = getSupabaseAdmin();
  const { data, error } = await db.storage.from(CARD_BUCKET).download(cardPath(postId, slide));
  if (error || !data) return null;
  return new Uint8Array(await data.arrayBuffer());
}

/**
 * Forget a post's cards.
 *
 * ⚠️ Called when a post is edited, so the next approval re-renders rather than
 * serving a picture of the old words. ⛔ Never throws: a stale file is a
 * smaller problem than an edit that fails.
 */
export async function dropCards(postId: string, upTo = 12): Promise<void> {
  const db = getSupabaseAdmin();
  try {
    const paths = [
      ...Array.from({ length: upTo }, (_, i) => cardPath(postId, i)),
      // ⚠️ AND THE MOVING ONE. An edit that left the old video behind would
      // publish the previous words set to the new approval — the same stale
      // -bytes problem as a still, and harder to notice in six seconds of
      // motion than in a glance at a picture.
      videoPath(postId, "mp4"),
      videoPath(postId, "gif"),
    ];
    await db.storage.from(CARD_BUCKET).remove(paths);
  } catch {
    // Deliberately swallowed ⇒ see above.
  }
}
