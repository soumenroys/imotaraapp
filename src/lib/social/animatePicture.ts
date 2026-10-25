// src/lib/social/animatePicture.ts
// A post's own picture, brought to life by a video model.
//
// 🔑 WHAT THE OWNER ASKED FOR, said plainly on 21 Oct after a pan was built
// instead: "animation with moving characters or objects like movie or cartoon
// film". A camera moving over a still is not that. This asks a video model to
// animate the picture itself — the characters already drawn for the post move.
//
// ⚠️ IMAGE-TO-VIDEO, NOT TEXT-TO-VIDEO. The picture is the post's own, already
// generated under the safety clause (no people, no faces of real people, no
// lettering) and already measured for where words can sit. Starting from it
// keeps the characters the reviewer saw; a fresh text-to-video would invent
// new ones nobody has looked at.
//
// ⛔ TRIAL ONLY. Nothing here publishes or replaces a post's motion.mp4. The
// owner sees one clip and decides, priced first: ~$0.10 per second at 720p
// (Gemini API pricing page, read 21 Oct 2026).

import { aiKeyFor } from "@/lib/imotara/aiKeys";

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/interactions";

/**
 * ⚠️ The GA model. The Veo 3.1 previews are shut down on 22 Oct 2026, and the
 * pricing page names this one as their replacement.
 */
export const ANIMATION_MODEL = "gemini-omni-1.1-flash";

/** ⚠️ The only two shapes the model makes ⇒ docs/omni, "aspect_ratio". */
export type AnimationAspect = "9:16" | "16:9";

/**
 * 🔑 THE INSTRUCTION. Motion only: everything that is already in the picture
 * stays, and nothing is added that the reviewer did not see.
 *
 * ⛔ No text, no new people, no faces turning into anyone — the same clause the
 * picture itself was drawn under ⇒ illustrationStyles. And calm: the frames
 * file refuses anything that demands attention, and that does not change
 * because the motion now comes from a model.
 */
export function animationPrompt(seconds = 8): string {
  return [
    `Animate this illustration as a gentle, calm ${seconds}-second clip.`,
    "Keep every character, object, colour and the art style exactly as drawn.",
    "Bring the existing characters and objects to life with small, natural movements:",
    "characters breathe, blink, turn slightly or gesture softly; lights flicker or twinkle;",
    "leaves, water, clouds or fabric move a little in a light breeze.",
    // 🔴 21 Oct: four of ten queued clips moved shapes and flowers across the
    // empty space where the post's words are set ⇒ motionBehindWords.
    "Keep every plain or empty area of the background calm and still: movement stays on the characters and objects themselves, and nothing drifts, floats or travels across open space.",
    "Do not add any new people, characters, text, letters, numbers, logos or signs.",
    "No camera cuts, no zoom, no fast motion, no flashing. Slow, soothing pacing throughout.",
  ].join(" ");
}

export type Animated =
  | { ok: true; mp4: Uint8Array; ms: number }
  | { ok: false; error: string };

/**
 * One clip from one picture.
 *
 * ⚠️ RETURNS A FAILURE RATHER THAN THROWING, like speak(): a trial that could
 * not be made is an answer, not a crash.
 */
export async function animatePicture(
  image: Uint8Array,
  opts: { aspect: AnimationAspect; prompt?: string; fetchImpl?: typeof fetch },
): Promise<Animated> {
  const key = aiKeyFor("gemini", "social");
  if (!key) return { ok: false, error: "GEMINI_API_KEY is not set here." };
  const doFetch = opts.fetchImpl ?? fetch;
  const started = Date.now();

  let res: Response;
  try {
    res = await doFetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        model: ANIMATION_MODEL,
        input: [
          { type: "image", data: Buffer.from(image).toString("base64"), mime_type: "image/jpeg" },
          { type: "text", text: opts.prompt ?? animationPrompt() },
        ],
        generation_config: { video_config: { task: "image_to_video" } },
        // ⚠️ `type: "video"` is REQUIRED by the API, though the docs' examples
        // mark it "optional" — the first trial was refused with "The 'type'
        // parameter is required at 'response_format'" (400, nothing charged).
        // ⛔ NO `delivery: "uri"`: the API refuses it unless `store` is true
        // ("store=true is required when response format has video delivery set
        // to URI", 400, nothing charged). Inline base64 keeps nothing at Google.
        response_format: { type: "video", aspect_ratio: opts.aspect, resolution: "720p" },
        // ⚠️ Synchronous, unstored ⇒ docs: "faster, synchronous unary generation".
        background: false,
        store: false,
        stream: false,
      }),
      // ⚠️ Capped so an approval that waits on this still has time to fall
      // back to the still picture ⇒ posts/[id] maxDuration.
      signal: AbortSignal.timeout(150_000),
    });
  } catch (e) {
    return { ok: false, error: `The video model could not be reached (${(e as Error).message}).` };
  }

  const text = await res.text();
  if (!res.ok) return { ok: false, error: `The video model answered ${res.status}: ${text.slice(0, 600)}` };

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return { ok: false, error: "The video model answered with something that is not JSON." };
  }

  const video = findVideo(body);
  if (!video) return { ok: false, error: `No video in the answer: ${text.slice(0, 600)}` };

  if (video.data) return { ok: true, mp4: new Uint8Array(Buffer.from(video.data, "base64")), ms: Date.now() - started };

  // ⚠️ URI delivery: the file may need a moment before it can be fetched.
  for (let attempt = 0; attempt < 30; attempt++) {
    const got = await doFetch(video.uri!, { headers: { "x-goog-api-key": key } });
    if (got.ok) {
      const bytes = new Uint8Array(await got.arrayBuffer());
      if (bytes.byteLength > 0) return { ok: true, mp4: bytes, ms: Date.now() - started };
    }
    await new Promise((r) => setTimeout(r, 3_000));
  }
  return { ok: false, error: "The video was made but could not be downloaded from its URI." };
}

/**
 * 🔑 THE VIDEO, wherever the answer puts it — the `model_output` step's
 * content, as base64 `data` or a `uri` ⇒ docs/omni, "Response shape".
 * ⚠️ Searched rather than indexed: a preview API's nesting is the part most
 * likely to move, and a fixed path would fail as "no video" with the video
 * sitting one level over.
 */
export function findVideo(body: unknown): { data?: string; uri?: string } | null {
  const seen = new Set<unknown>();
  const walk = (n: unknown): { data?: string; uri?: string } | null => {
    if (!n || typeof n !== "object" || seen.has(n)) return null;
    seen.add(n);
    const o = n as Record<string, unknown>;
    const isVideo = o.type === "video" || (typeof o.mime_type === "string" && o.mime_type.startsWith("video/"));
    if (isVideo && (typeof o.data === "string" || typeof o.uri === "string")) {
      return { data: o.data as string | undefined, uri: o.uri as string | undefined };
    }
    for (const v of Object.values(o)) {
      const hit = walk(v);
      if (hit) return hit;
    }
    return null;
  };
  return walk(body);
}
