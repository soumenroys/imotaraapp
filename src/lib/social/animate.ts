// src/lib/social/animate.ts
// Turning rendered frames into something that moves.
//
// 🔑 BOTH FORMATS, BECAUSE NEITHER COVERS EVERY CHANNEL.
//
//   • MP4 animates on LinkedIn, Facebook, Instagram and X — every channel that
//     matters here.
//   • ⛔ An animated GIF animates on X and NOWHERE ELSE: LinkedIn strips the
//     animation and posts the first frame, and Facebook converts it, often to
//     a still. It is the format people ask for and the one that works least.
//
// ⇒ So the frames are composed once and shared, and the schedule picks the
// encoder. ⚠️ The admin says which channels will actually move, rather than
// letting somebody discover it after posting.

import { spawn } from "child_process";
import { mkdtemp, writeFile, readFile, rm } from "fs/promises";
import { tmpdir } from "os";
import path from "path";

export type EncodeInput = {
  /** PNG frames, in order. */
  frames: Buffer[];
  /** How long each is held, in milliseconds. */
  holdMs: number[];
  width: number;
  height: number;
  /**
   * 🔑 AN AMBIENT BED, OPTIONAL ⇒ ambientBed.
   *
   * ⛔ MP4 ONLY. A GIF carries no audio at all, so passing this to encodeGif
   * is not a smaller version of the same thing — it is silently ignored, and
   * the caller should know that rather than wonder.
   */
  audioPath?: string;
  /** ⚠️ The chain applied before the fades — water is rolled off, a bowl is
   *  not ⇒ renderAnimation.AMBIENT_BEDS. */
  audioFilter?: string;
  /**
   * 🔑 THE POST, SPOKEN — one clip per scene, already aligned to the holds
   * ⇒ speech.ts. ⛔ Takes precedence over `audioPath`: a bed UNDER narration
   * is a mix, and mixing is a different job from laying a track.
   */
  narration?: { mp3: Uint8Array; startMs: number }[];
};

// ─────────────────────────────────────────────────────────────────────────────
// GIF
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ⚠️ ONE PALETTE FOR THE WHOLE CLIP, taken from the LAST frame.
 *
 * GIF allows a palette per frame, and using one would be both slower and
 * larger — and worse, it makes the colours shift as frames change, because two
 * independent quantisations of nearly the same image do not agree. The last
 * frame is the one that contains everything, so its palette covers them all.
 *
 * 🔑 These cards quantise unusually well: flat grounds, one accent, white
 * panels and text. GIF is a bad format for photographs and a good one for
 * exactly this.
 */
/** The minimum of gifenc's writer that this file uses. */
type GifWriter = {
  writeFrame: (indexed: Uint8Array, w: number, h: number, opts: Record<string, unknown>) => void;
  finish: () => void;
  bytes: () => Uint8Array;
};

/**
 * 🔑 THE OBJECT THAT ACTUALLY CARRIES `probe`, whether that is the module or
 * its `.default`.
 *
 * ⛔ WHY NOT `mod.default ?? mod`. That was the code. `??` falls back only on
 * null and undefined, and `gifenc`'s `.default` EXISTS AND IS EMPTY — so it
 * was always chosen, and every function came back undefined.
 *
 * ⚠️ MEASURED IN BOTH RUNTIMES, because the first measurement was misleading:
 *
 *   under tsx     gifenc .default = {} (0 keys)   upng-js .default = 8 keys
 *   under vitest  gifenc .default = {} (0 keys)   upng-js .default = 8 keys
 *
 * ⇒ gifenc was broken EVERYWHERE, not in one runtime. ⚠️ And upng-js's
 * top-level shape differs between the two, which is the deeper reason not to
 * encode a shape here at all: it is a property of the resolver, not of the
 * package.
 *
 * ⚠️ AND IT THROWS WITH THE MODULE'S NAME, at resolution rather than at use.
 * "quantize is not a function", thrown deep inside an encode, sent three
 * rounds of debugging at the encoder. "gifenc exports no `quantize`" names
 * the dependency and the missing export.
 */
export function interopPick<T>(mod: unknown, probe: keyof T & string, name: string): T {
  const top = mod as Record<string, unknown>;
  if (typeof top?.[probe] !== "undefined") return top as T;
  const inner = top?.default as Record<string, unknown> | undefined;
  if (typeof inner?.[probe] !== "undefined") return inner as T;
  throw new Error(
    `${name} exports no \`${probe}\`, at the top level or on \`default\` — ` +
      `its module shape has changed ⇒ interopPick.`,
  );
}

export async function encodeGif(input: EncodeInput): Promise<Buffer> {
  /**
   * 🔴 INTEROP, AND THE PREVIOUS VERSION OF THIS COMMENT WAS WRONG — which is
   * worth saying plainly, because it was wrong in a confident, specific way
   * and the code it justified did not work.
   *
   * ⛔ It read: "`gifenc` is CommonJS: under ESM its named exports arrive on
   * `.default`", and the code was `gifencMod.default ?? gifencMod`. MEASURED
   * 19 Oct, by printing the two modules:
   *
   *   gifenc   → named exports at the TOP LEVEL; `.default` exists and is EMPTY
   *   upng-js  → named exports on `.default`; top level has nothing usable
   *
   * ⚠️ They are opposite shapes, so no single hardcoded rule can serve both.
   * And `??` only falls back on null/undefined: an EMPTY `.default` object is
   * not nullish, so it won, and every function came back `undefined` — hence
   * `quantize is not a function` at the moment of encoding rather than at
   * import, which is what made it look like an import problem.
   *
   * 🔑 ⇒ Do not assume a shape. Take whichever object actually HAS the thing,
   * and say so loudly if neither does ⇒ interopPick.
   */
  const { GIFEncoder, quantize, applyPalette } = interopPick<{
    GIFEncoder: () => GifWriter;
    quantize: (rgba: Uint8Array, n: number) => number[][];
    applyPalette: (rgba: Uint8Array, palette: number[][]) => Uint8Array;
  }>(await import("gifenc"), "quantize", "gifenc");
  const UPNG = interopPick<{
    decode: (png: Buffer) => unknown;
    toRGBA8: (decoded: unknown) => ArrayBuffer[];
  }>(await import("upng-js"), "decode", "upng-js");

  const rgba = input.frames.map((png) => {
    const decoded = UPNG.decode(png);
    return new Uint8Array(UPNG.toRGBA8(decoded)[0]);
  });

  const last = rgba[rgba.length - 1];
  const palette = quantize(last, 256);

  const gif = GIFEncoder();
  rgba.forEach((frame, i) => {
    gif.writeFrame(applyPalette(frame, palette), input.width, input.height, {
      palette,
      // gifenc counts in hundredths of a second, and browsers treat anything
      // under ~20ms as "as fast as possible". Our shortest hold is 450ms.
      delay: input.holdMs[i] ?? 600,
      repeat: 0,
    });
  });
  gif.finish();
  return Buffer.from(gif.bytes());
}

// ─────────────────────────────────────────────────────────────────────────────
// MP4
// ─────────────────────────────────────────────────────────────────────────────

/** The ffmpeg binary that ships as a package, since there is none in the
 *  serverless runtime. ⚠️ Resolved lazily: importing it at module load would
 *  pull the binary into every bundle that touches this file. */
async function ffmpegPath(): Promise<string> {
  const mod = (await import("@ffmpeg-installer/ffmpeg")) as unknown as { path: string; default?: { path: string } };
  return mod.path ?? mod.default?.path ?? "ffmpeg";
}

function run(bin: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const p = spawn(bin, args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    p.stderr.on("data", (d) => {
      // ⚠️ Kept, but capped. ffmpeg is extremely chatty on success, and an
      // unbounded buffer on a 300-frame encode is its own failure.
      if (stderr.length < 8_000) stderr += String(d);
    });
    p.on("error", reject);
    p.on("close", (code) => {
      if (code === 0) return resolve();
      /**
       * 🔴 THE TAIL IS NOT THE ERROR, which cost three rounds to learn.
       *
       * ffmpeg prints a great deal while probing its inputs, and on failure
       * the last 1,200 characters can be entirely that noise. What the owner
       * saw was "ffmpeg exited 1: uration from bitrate, this may be
       * inaccurate" — the MIDDLE of a routine warning emitted while reading
       * input one, with the actual cause further down and cut off by the
       * admin's banner.
       *
       * ⇒ The lines that look like a cause are pulled out and put FIRST, so
       * a truncated message still carries the answer.
       */
      const lines = stderr.split("\n").map((l) => l.trim()).filter(Boolean);
      const blamed = lines.filter((l) =>
        /error|invalid|no such|unable|cannot|failed|filtergraph|not supported|conversion/i.test(l),
      );
      const summary = (blamed.length > 0 ? blamed : lines).slice(-6).join(" · ");
      // ⚠️ The whole thing reaches the SERVER LOG even when the message does
      // not reach the screen — Vercel logged nothing at all last time.
      console.error("[animate] ffmpeg failed", { code, stderr: stderr.slice(-4000) });
      reject(new Error(`ffmpeg exited ${code}: ${summary.slice(0, 900)}`));
    });
  });
}

/**
 * A silent MP4, from the same frames.
 *
 * ⚠️ `yuv420p` AND EVEN DIMENSIONS. That pixel format is what makes a video
 * play on iPhones and in Safari at all, and it requires both dimensions to be
 * even — LinkedIn's card is 1200×627, which is odd, and without the scale
 * filter ffmpeg fails with an error that says nothing about 627.
 *
 * ⛔ Silent on purpose. A post that makes noise in somebody's feed, on this
 * product, is the worst possible first impression.
 */
/**
 * ⚠️ LIKE `run`, BUT KEEPS STDERR, which is where ffmpeg prints a file's
 * header. `run` discards it because an encode's chatter is noise; here it is
 * the entire answer.
 */
function captureErr(bin: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const p = spawn(bin, args, { stdio: ["ignore", "ignore", "pipe"] });
    let err = "";
    p.stderr.on("data", (d) => {
      if (err.length < 8_000) err += String(d);
    });
    p.on("error", reject);
    /**
     * ⚠️ RESOLVES ON ANY EXIT CODE. `-f null -` decodes the whole file and
     * can exit non-zero for reasons that have nothing to do with the header
     * we are reading — and the Duration line is printed long before any of
     * them. ⛔ Rejecting would turn a readable clip into an unmeasured one.
     */
    p.on("close", () => resolve(err));
  });
}

/**
 * How long a clip actually is, in milliseconds.
 *
 * 🔑 MEASURED, NOT ESTIMATED, which is the whole reason narration is worth
 * having: scene length stops being my guess at reading speed and becomes the
 * time the sentence takes to say.
 *
 * ⛔ VIA FFMPEG, NOT FFPROBE, AND THAT WAS A CORRECTION. The obvious
 * implementation asks ffprobe, which normally ships beside ffmpeg — and
 * `@ffmpeg-installer` DOES NOT INCLUDE IT. Checked: the binary is simply not
 * there. ⚠️ It would have failed quietly, returning null and falling back to
 * the reading-speed estimate, so the narration and the scenes would have
 * drifted apart with nothing reporting it.
 *
 * ⇒ ffmpeg prints the duration to stderr when asked to decode to nothing.
 *
 * ⚠️ Returns null rather than throwing — an unmeasurable clip should fall
 * back to the estimate, not fail the post.
 */
export async function durationMs(file: string): Promise<number | null> {
  try {
    const out = await captureErr(await ffmpegPath(), ["-i", file, "-f", "null", "-"]);
    // "  Duration: 00:00:04.37, start: ..."
    const m = /Duration:\s*(\d+):(\d\d):(\d\d(?:\.\d+)?)/.exec(out);
    if (!m) return null;
    const ms = (Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3])) * 1000;
    return Number.isFinite(ms) && ms > 0 ? Math.round(ms) : null;
  } catch {
    return null;
  }
}

export async function encodeMp4(input: EncodeInput): Promise<Buffer> {
  const dir = await mkdtemp(path.join(tmpdir(), "imotara-anim-"));
  try {
    const lines: string[] = [];
    for (let i = 0; i < input.frames.length; i++) {
      const file = path.join(dir, `f${String(i).padStart(3, "0")}.png`);
      await writeFile(file, input.frames[i]);
      lines.push(`file '${file}'`);
      lines.push(`duration ${((input.holdMs[i] ?? 600) / 1000).toFixed(3)}`);
    }
    // ⚠️ The concat demuxer ignores the duration of the final entry, so the
    // last frame is listed twice. Without this the clip ends the instant the
    // finished card appears — which is the one frame anybody wants to see.
    lines.push(`file '${path.join(dir, `f${String(input.frames.length - 1).padStart(3, "0")}.png`)}'`);

    const list = path.join(dir, "frames.txt");
    await writeFile(list, lines.join("\n"), "utf8");

    const out = path.join(dir, "out.mp4");

    /**
     * 🔑 AN AMBIENT BED, WHEN ONE IS GIVEN ⇒ input.audioPath.
     *
     * ⚠️ BOTH PLATFORMS AUTOPLAY MUTED, so most viewers will never hear this.
     * It is here because its ABSENCE is noticeable: Instagram treats a reel
     * with no audio track at all as a weaker candidate, and somebody who
     * unmutes deliberately should not get silence.
     *
     * 🔴 A GENTLE TRIM, AND NOTHING ELSE. TWO WRONG ANSWERS CAME FIRST.
     *
     * ⛔ -18dB flat measured -46dB mean — nearly inaudible to somebody who
     * deliberately unmutes. These are already quiet ambient recordings.
     *
     * ⛔ Then `loudnorm=I=-26`, which hit the level and RUINED THE SOUND. The
     * owner heard it and said so: "only a hissing sound at background". In
     * single-pass mode loudnorm applies heavy dynamic correction, and on a
     * quiet textured bed that flattens the dynamics completely — the swell of
     * a wave and the gap between waves end up at the same level, which is the
     * definition of broadband noise. Rain stops sounding like rain and starts
     * sounding like tape hiss.
     *
     * ⚠️ AND IT WAS NEVER NEEDED. Measured across the first 19 seconds — the
     * part a clip actually uses — the three beds sit at -26.2, -27.6 and
     * -26.2dB. They are already matched to within 1.4dB and already at the
     * level a background wants. ⇒ A small trim keeps them under the words
     * without touching what makes them sound like water.
     *
     * 🔑 THE LESSON IS NOT ABOUT AUDIO. I reached for the heavier tool
     * because the first attempt failed, without measuring whether the lighter
     * one was enough. It was.
     *
     * ⚠️ FADED AT BOTH ENDS regardless. A bed that arrives at full volume is
     * a jump-scare on a post about a bad night, and one that stops dead is
     * worse.
     *
     * ⚠️ `-shortest` so the track is cut to the video and never the other way
     * round: the source files are five minutes long.
     */
    const seconds = input.holdMs.reduce((a, b) => a + b, 0) / 1000;

    /**
     * 🔑 NARRATION, LAID AT THE RIGHT MOMENTS ⇒ speech.ts.
     *
     * Each clip is delayed to the millisecond its scene begins and the lot
     * are mixed onto one track. ⛔ `adelay` rather than concatenating with
     * silence between: concatenation makes the audio define the timing, and
     * the timing is already decided by the SCENES. If a clip ran a touch long
     * every later line would slide, and the words in the ear would drift away
     * from the words on screen.
     *
     * ⚠️ `dropout_transition=0` and `normalize=0` on the mix: amix otherwise
     * ducks every input as others start and end, which on speech sounds like
     * the voice losing confidence mid-sentence.
     */
    const narration = input.narration ?? [];
    /**
     * ⛔ THE VIDEO CHAIN MOVES INTO THE COMPLEX GRAPH WHEN THERE IS ONE.
     *
     * 🔴 THIS IS WHAT BROKE IN PRODUCTION. ffmpeg refuses `-vf` and
     * `-filter_complex` for the SAME output stream: "Filtergraph ... was
     * specified through the -vf/-af/-filter option for output stream 0:0,
     * which is fed from a complex filtergraph." It exits 1, and the message
     * arrives truncated through two layers, so what the owner saw was
     * "ffmpeg exited 1: uration from bitrate, this may be inaccurate".
     *
     * ⚠️ AND IT COULD NOT FAIL LOCALLY, because narration needs Azure and
     * every region in this machine's .env.local has an empty region value —
     * so every local run took the silent path, which uses `-vf` and is fine.
     * The one branch I could not exercise is the one that was wrong.
     */
    const VIDEO_CHAIN = "scale=trunc(iw/2)*2:trunc(ih/2)*2,fps=25,format=yuv420p";

    const spoken =
      narration.length > 0
        ? [
            ...narration.flatMap((_, i) => ["-i", `${dir}/say${i}.mp3`]),
            "-filter_complex",
            `[0:v]${VIDEO_CHAIN}[v];` +
              narration
                .map((n, i) => `[${i + 1}:a]adelay=${n.startMs}|${n.startMs}[s${i}]`)
                .join(";") +
              /**
               * ⛔ NO `normalize` OPTION, AND THE REASON IS VERSION SKEW.
               *
               * 🔴 `amix`'s `normalize` arrived in ffmpeg 4.4. This machine
               * has 4.4; VERCEL RUNS A 2018 STATIC BUILD (libavfilter
               * 7.46.101), which rejects the argument outright — "Error
               * initializing filter 'amix'". It therefore worked perfectly
               * locally and failed every time in production.
               *
               * ⚠️ AND NOTHING REPLACES IT, WHICH I GOT WRONG TWICE BY
               * REASONING INSTEAD OF MEASURING. I argued that amix divides by
               * the input count and added `volume=inputs` to compensate.
               * Measured: three delayed copies of a clip whose peak is
               * -18.5dB mix to -18.9dB — no attenuation at all. The
               * compensation was a straight +9.5dB boost, which real speech
               * (louder than a test tone) would have clipped.
               *
               * ⛔ Non-overlapping inputs need no gain correction: only one
               * is ever audible, so the sum is just that one.
               *
               * 🔑 THE RULE THIS LEAVES: production's ffmpeg is OLDER than
               * the one here. Anything newer than ~2018 has to be checked
               * against it, not against this machine.
               */
              `;${narration.map((_, i) => `[s${i}]`).join("")}` +
              `amix=inputs=${narration.length}:dropout_transition=0[a]`,
            "-map", "[v]",
            "-map", "[a]",
            "-c:a", "aac",
            "-b:a", "128k",
            "-shortest",
          ]
        : [];

    for (const [i, n] of narration.entries()) {
      await writeFile(`${dir}/say${i}.mp3`, Buffer.from(n.mp3));
    }

    const audio = input.audioPath && narration.length === 0
      ? [
          "-i", input.audioPath,
          "-filter_complex",
          // ⛔ Same clash as above: with a complex graph the VIDEO must come
          // through it too, never through -vf.
          `[0:v]${VIDEO_CHAIN}[v];[1:a]${input.audioFilter ? `${input.audioFilter},` : ""}afade=t=in:st=0:d=1.2,afade=t=out:st=${Math.max(0, seconds - 1.5).toFixed(2)}:d=1.5[a]`,
          "-map", "[v]",
          "-map", "[a]",
          "-c:a", "aac",
          "-b:a", "128k",
          "-shortest",
        ]
      : [];

    await run(await ffmpegPath(), [
      "-y",
      "-f", "concat",
      "-safe", "0",
      "-i", list,
      ...spoken,
      ...audio,
      // ⚠️ ONLY when nothing else filters the video ⇒ see VIDEO_CHAIN above.
      ...(spoken.length === 0 && audio.length === 0 ? ["-vf", VIDEO_CHAIN] : []),
      "-c:v", "libx264",
      "-preset", "veryfast",
      "-crf", "20",
      "-movflags", "+faststart",
      out,
    ]);

    return await readFile(out);
  } finally {
    // ⛔ Always, even on failure: /tmp is 512MB and a leaked frame set is
    // ~10MB. Twenty failed encodes would take the function down.
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

// ─────────────────────────────────────────────────────────────────────────────

// ⚠️ Re-exported so server callers need one import. The definitions live in
// animationFacts.ts, which a browser can safely load ⇒ the schedule form needs
// the warning and must not need ffmpeg.
export {
  ANIMATES_ON,
  animationWarning,
  MIME,
  type AnimationFormat,
} from "@/lib/social/animationFacts";

import type { AnimationFormat as Fmt } from "@/lib/social/animationFacts";

export async function encode(format: Fmt, input: EncodeInput): Promise<Buffer> {
  return format === "gif" ? encodeGif(input) : encodeMp4(input);
}
