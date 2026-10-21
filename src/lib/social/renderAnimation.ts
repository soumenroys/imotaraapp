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
import { storyboard, wordsLayer, driftFor } from "@/lib/social/frames";
import { toElement, loadFont, resolveIllustration, type PictureSource } from "@/lib/social/renderPicture";
import { encode, durationMs } from "@/lib/social/animate";
import { speak } from "@/lib/social/speech";
import { writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { allQrCodes } from "@/lib/social/brandMarks";
import { eyebrowFor } from "@/lib/social/topicPools";
import { headlineFor, withoutHashtags, type Recipe } from "@/lib/social/visualRecipe";
import { platformSpec } from "@/lib/social/platforms";

export type AnimationFormat = "gif" | "mp4";

/**
 * 🔑 THE SOUND A VIDEO CARRIES — including no sound at all.
 *
 * ⚠️ THESE ARE THE PRODUCT'S OWN BREATHING SOUNDS ⇒ public/sounds, which is
 * most of why they are right: they are calm because they were made to be
 * breathed to, not chosen for a feed.
 *
 * 🔴 WATER IS LOW-PASSED AND THE BOWL IS NOT, AND THAT IS NOT A PREFERENCE.
 * The owner heard the first ocean version and said "only a hissing sound at
 * background" — correctly. Rain and ocean are BROADBAND NOISE, and quiet
 * broadband noise with nothing else in the mix is, physically, hiss. ⛔ My
 * first theory was that loudnorm had flattened the dynamics; I measured it
 * and it had not (20.4dB of range against 20.7dB without). The material was
 * the answer, not the processing.
 *
 * ⇒ Rolling off above 1.2kHz turns fizz into a warm rumble, with a little
 * gain back because the filter removes energy. A singing bowl needs none of
 * this: it is TONAL, so it has pitch and can never collapse into noise.
 *
 * 🔑 SILENCE IS ONE OF THE OPTIONS, at the owner's request. It costs a small
 * Reels ranking nudge and nothing else, and a feed where every video sounds
 * the same is the complaint that started all of this.
 *
 * ⛔ PROVENANCE REMAINS THE OWNER'S TO CONFIRM. "Licensed for in-app use" and
 * "licensed for marketing" are different grants. ▶️ If these turn out to be
 * in-app only, delete every entry with a `file` and leave the silent one —
 * every video then publishes silent and nothing else changes.
 */
export type Bed = {
  /** ⚠️ `null` is a real choice, not a missing value: it means silence. */
  file: string | null;
  /** The ffmpeg chain applied before the fades. */
  filter: string;
};

/**
 * 🔴 SILENT, BY THE OWNER'S DECISION — 19 Oct 2026.
 *
 * They listened to all four and liked all four. The reason this is silent is
 * NOT that the sound was wrong: it is that the three files ship with the app
 * for its breathing exercise, and "licensed for in-app use" and "licensed for
 * marketing" are different grants. Nobody has confirmed which one these
 * carry, and a brand's video is not the place to find out.
 *
 * ⛔ SO THE TUNED TREATMENTS ARE KEPT, NOT DELETED. Each one cost a
 * measurement, and throwing that away would mean redoing it if the licence
 * clears:
 *
 *   { file: "bowl.mp3",  filter: "volume=-3dB" }
 *   { file: "rain.mp3",  filter: "lowpass=f=1200,volume=+2dB" }
 *   { file: "ocean.mp3", filter: "lowpass=f=1200,volume=+2dB" }
 *
 * ⚠️ THE ROLL-OFF ON THE WATER IS THE MEASUREMENT WORTH NOT LOSING. Rain and
 * ocean are broadband noise, and quiet broadband noise with nothing else in
 * the mix is physically hiss — which is exactly what the owner heard on the
 * first attempt. The bowl needs none of it because it is tonal.
 *
 * ▶️ TO BRING SOUND BACK: confirm the licence, then paste those three lines
 * back above the silent entry. Nothing else changes — the encoder, the fades
 * and the per-post selection are all still here and still tested.
 */
export const AMBIENT_BEDS: Bed[] = [
  // ⛔ The only entry until the licence is confirmed.
  { file: null, filter: "" },
];

/**
 * Which bed this post gets.
 *
 * ⚠️ CHOSEN FROM THE RECIPE HASH, not at random and not always the same one.
 * Random would mean a post re-encoded after an edit arrives with a different
 * sound than the one somebody approved; always-the-same would make every
 * video in the feed identical to hear.
 */
export function ambientBed(recipeHash: string | undefined): Bed | null {
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
  /**
   * 🔑 THE POST'S OWN SUBJECT, as a topic-pool id ⇒ eyebrowFor.
   *
   * ⛔ REQUIRED, NOT OPTIONAL, and that is the whole safety argument. Six
   * paths draw a card for the same post, and an optional field is one a path
   * can silently omit — which is exactly how `wash` went missing from a
   * field-by-field rebuild here and would have rendered every card flat.
   * Required means the compiler names any path that forgets.
   */
  topic_pool: string | null;
  /**
   * 🔑 THE BACKGROUND, as stored on the row ⇒ PictureSource.illustration.
   *
   * ⛔ REQUIRED for the same reason as topic_pool, and with a worse history:
   * when every queued post gained a picture on 20 Oct, both video callers
   * selected a column list without it, so every video kept the bare palette
   * card while its background.jpg sat beside it in the bucket. Optional is how
   * that stayed invisible; required makes the compiler name the caller.
   */
  illustration: PictureSource["illustration"];
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
  // ⚠️ Same resolver as the still ⇒ a failed fetch draws today's plain card.
  const illustration = await resolveIllustration(post.illustration);

  let board;
  try {
    board = storyboard({
      recipe: post.visual_recipe as Recipe,
      headline,
      eyebrow: eyebrowFor(post.topic_pool, post.language),
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
      /**
       * 🔴 WITHOUT THE HASHTAGS, and that was a defect for a day.
       *
       * ⛔ Passing `post.body` raw — which is what "the whole body, not one
       * sentence" first meant here — ends a four-scene video on a frame
       * reading "#imfine #theunsaid #quietthoughts #feelings", in type, and
       * then has the NARRATOR READ THEM OUT. Tags have no sentence-ending
       * punctuation, so `sentencesOf` hands them back as a scene of their own.
       *
       * ⚠️ `supportFromBody` had always stripped them ⇒ the Instagram card
       * that caught this the first time. Replacing that call with the raw body
       * took the stripping away with it — a fix for one thing undoing another
       * ⇒ trap_blunt_fix_trades_one_failure_for_its_opposite.
       */
      support: withoutHashtags(post.body),
      language: post.language,
      platform: post.platform,
      qrCodes,
      illustration,
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

  /**
   * 🔑 THE DRIFT: in an MP4 with a picture, the frames carry only the veil and
   * the words, and the picture is handed to the encoder to pan under them
   * ⇒ frames.wordsLayer, animate.videoGraph.
   *
   * ⚠️ All or nothing. If any frame does not have the picture where compose
   * puts it, every frame is drawn whole, as before — a still picture is fine,
   * half a clip with no background is not.
   */
  const layers =
    format === "mp4" && illustration
      ? board.frames.map((f) => wordsLayer(f, illustration.src))
      : null;
  const drifting = layers !== null && layers.every((l) => l !== null);
  let backgroundFile: string | null = null;
  if (drifting) {
    backgroundFile = join(tmpdir(), `imotara-bg-${randomUUID()}.jpg`);
    await writeFile(backgroundFile, Buffer.from(illustration!.src.split(",")[1] ?? "", "base64"));
  }

  const frames: Buffer[] = [];
  for (const [i, whole] of board.frames.entries()) {
    const frame = drifting ? layers![i]! : whole;
    const image = new ImageResponse(toElement(frame), {
      width: board.width,
      height: board.height,
      fonts: [{ name: board.wordmark.font.family, data: fontData, weight: 600, style: "normal" }],
    });
    frames.push(Buffer.from(await image.arrayBuffer()));
  }

  try {
    /**
     * 🔑 THE POST, SPOKEN, AND THE SCENES RE-TIMED TO IT ⇒ speech.ts.
     *
     * ⛔ THE RE-TIMING IS THE POINT, not the sound. Scene length was my
     * ESTIMATE of reading speed — 380ms a word, capped — which is a guess
     * wearing a number's clothes. A spoken sentence has a real duration, and
     * the scene can simply last that long.
     *
     * ⚠️ IT FAILS TO SILENT, NEVER TO A FAILED POST. If Azure is busy, not
     * configured, or returns nothing, the video is made exactly as it was
     * before with the estimated holds. The words are the post; the voice is
     * a courtesy.
     */
    // ⚠️ Exactly what each scene shows ⇒ board.sceneTexts, never re-split here.
    const lines = board.sceneTexts;
    const narration: { mp3: Uint8Array; startMs: number }[] = [];
    const spokenMs: (number | null)[] = [];

    for (const line of lines) {
      const said = await speak(line, post.language);
      if (!said.ok) {
        // ⛔ One failure stops the lot: a video narrating two sentences of
        // four and falling silent is worse than one that never spoke.
        narration.length = 0;
        spokenMs.length = 0;
        break;
      }
      const file = join(tmpdir(), `imotara-say-${randomUUID()}.mp3`);
      await writeFile(file, Buffer.from(said.mp3));
      const ms = await durationMs(file);
      await rm(file, { force: true }).catch(() => {});
      narration.push({ mp3: said.mp3, startMs: 0 });
      spokenMs.push(ms);
    }

    /**
     * ⚠️ A CLIP WE COULD NOT MEASURE KEEPS THE ESTIMATE, rather than being
     * guessed at. ⛔ And a little room after each line: speech that ends the
     * instant the scene changes reads as rushed, and the pause is where a
     * sentence lands.
     */
    const PAUSE_MS = 700;
    if (narration.length === lines.length && spokenMs.every((m) => m !== null)) {
      const holds = board.holdMs.slice();
      let at = 0;
      for (const [i, ms] of (spokenMs as number[]).entries()) {
        const index = board.sceneIndexes[i];
        if (index === undefined) continue;
        holds[index] = Math.max(board.holdMs[index], ms + PAUSE_MS);
      }
      // ⚠️ Starts are computed AFTER every hold is final, or a later line is
      // delayed to a moment that moved.
      for (const [i, h] of holds.entries()) {
        const which = board.sceneIndexes.indexOf(i);
        if (which >= 0 && narration[which]) narration[which].startMs = at;
        at += h;
      }
      board.holdMs.splice(0, board.holdMs.length, ...holds);
    } else {
      narration.length = 0;
    }

    /**
     * ⚠️ RESOLVED FROM THE FILESYSTEM, and absent is not an error. A missing
     * sound file must mean a silent video, never a failed post — the words
     * are the post and the bed is a courtesy.
     */
    const bed = format === "mp4" ? ambientBed((post.visual_recipe as Recipe | null)?.hash) : null;
    // ⚠️ `bed.file === null` is SILENCE and must not become a lookup of
    // "null.mp3" — the one place where an absent value is a decision.
    const audioPath = bed?.file ? join(process.cwd(), "public", "sounds", bed.file) : undefined;

    const out = await encode(format, {
      frames,
      holdMs: board.holdMs,
      width: board.width,
      height: board.height,
      ...(narration.length > 0 ? { narration } : {}),
      ...(audioPath && existsSync(audioPath) ? { audioPath, audioFilter: bed?.filter } : {}),
      ...(backgroundFile
        ? { background: { path: backgroundFile, drift: driftFor((post.visual_recipe as Recipe | null)?.hash) } }
        : {}),
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
  } finally {
    // ⛔ Always: /tmp is small on a serverless box and a leaked picture is
    // the same leak the frame directory guards against in animate.ts.
    if (backgroundFile) await rm(backgroundFile, { force: true }).catch(() => {});
  }
}
