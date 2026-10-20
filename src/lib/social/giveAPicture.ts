// src/lib/social/giveAPicture.ts
// Giving a queued post its background, once.
//
// 🔴 EVERYTHING HERE IS ADDITIVE AND FAILURE-TOLERANT, and that is the single
// most important property. A post without a background composes exactly the
// card this product published all week — so a model outage, a storage hiccup
// or a safety refusal costs a nicer picture and NEVER a slot.
//
// ⛔ A missing post is worse than a plain one. That has been relearned enough
// times this month to be written down: the blank poster, the four empty
// Instagram slots, the alert that could not post its own letter.
//
// 🔑 ONCE PER POST, AT QUEUE TIME. Drawing on every render would spend money
// on every approval, preview and retry — and would show the reviewer a
// different picture from the one that publishes, which is an approval gate
// approving something nobody will see.

import sharp from "sharp";
import { generateIllustration, styleForPost, type IllustrationStyle } from "@/lib/social/illustration";
import { planBackground } from "@/lib/social/backgroundPlan";
import { putIllustration } from "@/lib/social/cardStore";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { istDayWindow } from "@/lib/social/pipeline";

/** What is written onto the post ⇒ docs/sql/social_illustration.sql. */
export type StoredIllustration = {
  path: string;
  style: string;
  zone: IllustrationStyle["textZone"];
  ink: "light" | "dark";
  scrim: number;
  measured: { mean: number; sd: number };
};

/**
 * ⚠️ THE MODEL IS NAMED HERE AND NOWHERE ELSE, so the id that ships is the one
 * read off the key's own model list rather than remembered
 * ⇒ trap_a_model_invents_specifics_it_cannot_have. Measured 20 Oct 2026 by
 * asking the API what it could draw with.
 */
export const IMAGE_MODEL = "gemini-2.5-flash-image";

/**
 * 🔑 JPEG, AND NOT FOR TIDINESS. Instagram's Content Publishing API documents
 * JPEG and rejects the rest, and the background is inlined into a card that
 * Instagram fetches ⇒ trap_instagram_takes_a_url_not_an_image. ⚠️ Quality 86
 * keeps a 1024px background near 150KB, which matters because it is base64'd
 * into the card's own render.
 */
const JPEG_QUALITY = 86;

export type GiveResult =
  | { ok: true; illustration: StoredIllustration }
  | { ok: false; reason: string };

/**
 * Draw this post's background, measure it, store it, and record it.
 *
 * ⛔ RETURNS A REASON RATHER THAN THROWING. The caller is the queue cron and a
 * thrown error there loses the whole run, not just the picture.
 */
export async function giveAPicture(args: {
  postId: string;
  /** Rotates the style, narrowed by the day and by what the post is about. */
  postsSoFar: number;
  /** What the other channels already used today ⇒ styleForPost. */
  usedToday?: string[];
  /** The angle this post was written from, so the picture suits the words. */
  angle?: string | null;
  /** The subject, passed as a feeling to evoke — never as something to depict. */
  mood?: string | null;
  model?: string;
}): Promise<GiveResult> {
  const style = styleForPost(args.postsSoFar, args.usedToday ?? [], args.angle ?? null);

  const drawn = await generateIllustration({
    style,
    mood: args.mood ?? null,
    model: args.model ?? IMAGE_MODEL,
  });
  if (!drawn.ok) {
    return { ok: false, reason: `${style.id}: ${drawn.reason}${drawn.detail ? ` — ${drawn.detail.slice(0, 300)}` : ""}` };
  }

  let jpeg: Buffer;
  try {
    jpeg = await sharp(Buffer.from(drawn.bytes)).jpeg({ quality: JPEG_QUALITY }).toBuffer();
  } catch (e) {
    return { ok: false, reason: `${style.id}: the drawing could not be converted — ${(e as Error).message}` };
  }

  /**
   * ⛔ MEASURED FROM THE BYTES THAT WILL BE STORED, not from what was drawn.
   * The JPEG conversion changes pixels, and measuring the PNG would mean the
   * ink was chosen from an image nobody will ever see.
   */
  const plan = await planBackground(jpeg, style.textZone);

  const stored = await putIllustration(args.postId, new Uint8Array(jpeg));
  if (!stored.ok) return { ok: false, reason: `${style.id}: ${stored.error}` };

  const illustration: StoredIllustration = {
    path: stored.path,
    style: style.id,
    zone: style.textZone,
    ink: plan.ink,
    scrim: plan.scrim,
    measured: plan.measured,
  };

  const db = getSupabaseAdmin();
  const { error } = await db.from("social_posts").update({ illustration }).eq("id", args.postId);
  if (error) {
    /**
     * ⚠️ THE PICTURE IS IN THE BUCKET AND THE ROW DOES NOT KNOW. Harmless: the
     * card composes without it, and the orphan is overwritten the next time
     * this post is given a picture. ⛔ Reported rather than swallowed, because
     * a bucket filling with pictures nothing references is worth noticing.
     */
    return { ok: false, reason: `${style.id}: stored at ${stored.path} but the post could not be updated — ${error.message}` };
  }

  return { ok: true, illustration };
}

/**
 * The window a style must not repeat inside.
 *
 * 🔴 WIDENED FROM ONE DAY TO THREE, 20 Oct 2026. Narrowing by the day alone
 * stopped two channels sharing a style on one evening — and let the same style
 * come back the very next morning. Six backfilled posts drew `coloured-pencil`
 * TWICE, on consecutive days, out of thirteen available. Not wrong, and not
 * the variety the owner asked for either.
 *
 * ⚠️ THREE DAYS IS THE PRACTICAL CEILING, not a round number. At three posts a
 * day a three-day window already spends nine of thirteen styles; four days
 * would spend twelve, leave one, and the never-empty fallback would fire on
 * nearly every post — a narrowing that always falls back is not a narrowing.
 */
export const STYLE_WINDOW_DAYS = 3;

export function styleWindow(scheduledForISO: string): { from: string; to: string } {
  const day = 86_400_000;
  const t = new Date(scheduledForISO).getTime();
  const back = istDayWindow(new Date(t - day).toISOString());
  const forward = istDayWindow(new Date(t + day).toISOString());
  return { from: back.from, to: forward.to };
}

/**
 * The styles already spent in that window, across every channel.
 *
 * 🔑 SAME SHAPE AS THE ANGLE NARROWING, and for the same reason: the rotation
 * counter is per schedule, so two channels with the same pool march in
 * lockstep ⇒ this was measured live on 20 Oct, when YouTube and Instagram
 * posted the same idea thirty minutes apart.
 */
export async function stylesUsedOn(fromISO: string, toISO: string): Promise<string[]> {
  const db = getSupabaseAdmin();
  const { data } = await db
    .from("social_posts")
    .select("illustration")
    .gte("scheduled_for", fromISO)
    .lt("scheduled_for", toISO)
    .neq("status", "skipped");
  return (data ?? [])
    .map((r) => (r.illustration as StoredIllustration | null)?.style)
    .filter((s): s is string => Boolean(s));
}
