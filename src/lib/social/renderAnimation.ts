// src/lib/social/renderAnimation.ts
// The moving card, as bytes — for the admin's preview and for publishing.
//
// 🔴 EXTRACTED SO THE TWO CANNOT DRIFT. The admin route has rendered
// animations since they were built; the publisher never has. Writing a second
// copy for it is how the card a reviewer approved comes to differ from the one
// the world sees — and that difference would be invisible, because nobody
// compares a preview with a published video frame by frame.
//
// ⚠️ THIS IS THE SAME LESSON renderPicture.ts ALREADY RECORDS: "⛔ Two
// renderers would mean the card a reviewer approved and the card the world
// sees could differ — silently, and only on the one nobody can check
// afterwards."

import { ImageResponse } from "next/og";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { storyboard } from "@/lib/social/frames";
import { toElement, loadFont } from "@/lib/social/renderPicture";
import { encode } from "@/lib/social/animate";
import { allQrCodes } from "@/lib/social/brandMarks";
import { headlineFor, supportFromBody, type Recipe } from "@/lib/social/visualRecipe";
import { platformSpec } from "@/lib/social/platforms";

export type AnimationFormat = "gif" | "mp4";

/**
 * 🔑 THE AMBIENT BEDS THE PRODUCT ALREADY SHIPS ⇒ public/sounds.
 *
 * ⚠️ THESE ARE THE BREATHING SOUNDS, not a track chosen for a feed — which is
 * most of why they are right: they are calm because they were made to be
 * breathed to, and they are literally the sound of the thing being posted
 * about.
 *
 * ⛔ PROVENANCE IS UNCONFIRMED AND THE OWNER WAS TOLD SO. "Licensed for
 * in-app use" and "licensed for marketing" are different grants, and a stock
 * licence that covers the first does not always cover the second. ▶️ If these
 * turn out to be in-app only, set AMBIENT_BEDS to [] — every video then
 * publishes silent and nothing else changes.
 */
// ⚠️ `string[]`, not `as const`: the whole point is that this can be
// emptied if the licence turns out not to cover marketing, and a literal
// tuple type makes `length === 0` a compile error rather than a setting.
export const AMBIENT_BEDS: string[] = ["rain.mp3", "ocean.mp3", "bowl.mp3"];

/**
 * Which bed this post gets.
 *
 * ⚠️ CHOSEN FROM THE RECIPE HASH, not at random and not always the same one.
 * Random would mean a post re-encoded after an edit could arrive with a
 * different sound than the one somebody approved; always-the-same would make
 * every video in the feed identical to hear.
 */
export function ambientBed(recipeHash: string | undefined): string | null {
  if (AMBIENT_BEDS.length === 0 || !recipeHash) return null;
  let n = 0;
  for (const ch of recipeHash) n = (n + ch.charCodeAt(0)) % 997;
  return AMBIENT_BEDS[n % AMBIENT_BEDS.length];
}

export type AnimationSource = {
  platform: string;
  language: string;
  subject: string | null;
  body: string;
  media_kind: string | null;
  visual_recipe: unknown;
};

export type AnimationResult =
  | { ok: true; bytes: Uint8Array; width: number; height: number; ms: number }
  /** ⚠️ `status` so a route can answer honestly: 404 nothing to draw, 422 the
   *  words cannot make one, 500 the encoder, 502 the font. */
  | { ok: false; status: number; error: string };

/**
 * 🔑 WHICH FORMAT A CHANNEL SHOULD BE SENT.
 *
 * ⛔ An animated GIF animates on X and NOWHERE ELSE — LinkedIn strips it and
 * Facebook converts it, both silently ⇒ animate.ts. So the stored SHAPE may
 * say `animated_gif`, and what actually goes to Facebook is still an MP4.
 * ⚠️ The alternative is a still frame that everybody assumes is moving.
 */
export function formatForChannel(platform: string, mediaKind: string | null): AnimationFormat {
  if (mediaKind === "animated_gif" && platform === "x") return "gif";
  return "mp4";
}

/** The moving card, rendered the one way it is ever rendered. */
export async function renderAnimation(
  post: AnimationSource,
  format: AnimationFormat,
): Promise<AnimationResult> {
  const started = Date.now();

  if (post.media_kind !== "animated_gif" && post.media_kind !== "short_video") {
    return { ok: false, status: 404, error: "This post does not move." };
  }
  if (!post.visual_recipe) {
    return { ok: false, status: 422, error: "This post has no stored recipe, so no frames can be drawn." };
  }

  const headline = headlineFor(post.subject ?? "", post.body);
  if (!headline) {
    return {
      ok: false,
      status: 422,
      error:
        "Neither the subject nor the opening sentence is short enough to set as a headline, and " +
        "neither is truncated here — half a thought on a card reads worse than no card.",
    };
  }

  const spec = platformSpec(post.platform);
  const qrCodes = spec.qr ? await allQrCodes(post.platform) : undefined;

  let board;
  try {
    board = storyboard({
      recipe: post.visual_recipe as Recipe,
      headline,
      /**
       * 🔑 THE WHOLE BODY, NOT ONE SENTENCE — changed 19 Oct.
       *
       * ⛔ This used to pass `supportFromBody`, which returns ONE sentence.
       * The storyboard then had nothing else to show, so a four-sentence post
       * became a six-second video carrying one line. The owner asked for more
       * content and was right: the content was already written and thrown
       * away here.
       *
       * ⚠️ The storyboard splits it into scenes and caps them ⇒ sentencesOf.
       * A body it cannot split cleanly still yields one scene, which is
       * exactly the old behaviour.
       */
      support: post.body,
      language: post.language,
      platform: post.platform,
      qrCodes,
    });
  } catch (e) {
    return { ok: false, status: 422, error: (e as Error).message };
  }

  let fontData: ArrayBuffer;
  try {
    fontData = await loadFont(board.wordmark.font.url);
  } catch (e) {
    return { ok: false, status: 502, error: (e as Error).message };
  }

  const frames: Buffer[] = [];
  for (const frame of board.frames) {
    const image = new ImageResponse(toElement(frame), {
      width: board.width,
      height: board.height,
      fonts: [{ name: board.wordmark.font.family, data: fontData, weight: 600, style: "normal" }],
    });
    frames.push(Buffer.from(await image.arrayBuffer()));
  }

  try {
    /**
     * ⚠️ RESOLVED FROM THE FILESYSTEM, and absent is not an error. A missing
     * sound file must mean a silent video, never a failed post — the words
     * are the post and the bed is a courtesy.
     */
    const bed = format === "mp4" ? ambientBed((post.visual_recipe as Recipe | null)?.hash) : null;
    const audioPath = bed ? join(process.cwd(), "public", "sounds", bed) : undefined;

    const out = await encode(format, {
      frames,
      holdMs: board.holdMs,
      width: board.width,
      height: board.height,
      ...(audioPath && existsSync(audioPath) ? { audioPath } : {}),
    });
    return { ok: true, bytes: new Uint8Array(out), width: board.width, height: board.height, ms: Date.now() - started };
  } catch (e) {
    /**
     * ⚠️ NAMED PLAINLY. "Could not render" would send somebody to the wrong
     * place: a missing ffmpeg binary is a deployment problem, not a content
     * one, and the two are fixed by different people.
     */
    return {
      ok: false,
      status: 500,
      error: `The ${format.toUpperCase()} could not be encoded: ${(e as Error).message}`,
    };
  }
}
