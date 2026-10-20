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
 * 🔴 EVERY CONTENT TYPE THIS MODULE MAY UPLOAD — DECLARED ONCE, HERE.
 *
 * ⛔ THE DEFECT THIS EXISTS FOR, live on 19 Oct. The bucket was created with
 * `allowed_mime_types = array['image/jpeg']`, back when the only thing stored
 * in it was a JPEG card. Video storage was added to the SAME bucket months
 * later and nothing told the bucket. Approval then failed with
 * "mime type video/mp4 is not supported" — after ffmpeg had done all its work.
 *
 * 🔑 AND THE CONSTRAINT WAS ALREADY WRITTEN DOWN IN THIS FILE, three
 * functions below: "`.jpg` because the bucket only accepts image/jpeg". A
 * limit recorded in a COMMENT cannot be consulted by the code that has to
 * satisfy it ⇒ trap_a_constraint_nobody_told_the_writer. ⇒ It is a value now,
 * and `aBucketAcceptsWhatTheCodeSends` holds it against the SQL that creates
 * the bucket, so adding a fourth type here fails until the bucket is told.
 *
 * ⚠️ KEEP SORTED. The test compares it to the SQL as a set, but a stable
 * order keeps the diff honest when one is added.
 */
export const STORED_MIME_TYPES = ["image/gif", "image/jpeg", "video/mp4"] as const;

/**
 * ⚠️ 50 MB, and the reasoning rather than a round number.
 *
 * Measured 19 Oct: the queued Facebook post — four sentences, seven frames,
 * 18.9 seconds at 1200×630 — encodes to 106 KB silent, 150 KB at X's
 * 1600×900. Narration re-times the scenes longer and adds AAC at 128 kbps,
 * so a three-minute narrated video would still be a few MB.
 *
 * ⛔ The limit is here to stop a BUG filling the bucket, not because a card
 * could legitimately be large — which is why it is generous and finite rather
 * than absent. A GIF is the one format that could approach it, and GIFs only
 * go to X, which does not publish yet.
 */
export const STORED_BYTES_MAX = 50 * 1024 * 1024;

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
/**
 * Where a post's background picture lives.
 *
 * ⚠️ ONE PER POST, GENERATED ONCE. Re-drawing it on every render would spend
 * money on every approval, every preview and every retry — and would give the
 * reviewer a different picture from the one that publishes, which is the
 * approval gate approving something nobody will see.
 */
export function illustrationPath(postId: string): string {
  return `${postId}/background.jpg`;
}

/** Keep a post's background. Same upsert rule as the rest. */
export async function putIllustration(
  postId: string,
  bytes: Uint8Array,
): Promise<{ ok: true; path: string } | { ok: false; error: string }> {
  const db = getSupabaseAdmin();
  const path = illustrationPath(postId);
  const { error } = await db.storage
    .from(CARD_BUCKET)
    .upload(path, bytes, { contentType: "image/jpeg", upsert: true });
  if (error) return { ok: false, error: `The background could not be stored: ${error.message}` };
  return { ok: true, path };
}

/**
 * The stored background, or nothing.
 *
 * ⛔ NULL IS A PERFECTLY GOOD ANSWER and the caller composes today's card.
 * A background is an addition; a post without one is the card this product
 * published all week. ⚠️ A storage hiccup must never cost a slot.
 */
export async function getIllustration(postId: string): Promise<Uint8Array | null> {
  const db = getSupabaseAdmin();
  const { data, error } = await db.storage.from(CARD_BUCKET).download(illustrationPath(postId));
  if (error || !data) return null;
  return new Uint8Array(await data.arrayBuffer());
}

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
