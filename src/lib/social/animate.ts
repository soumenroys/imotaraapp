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
export async function encodeGif(input: EncodeInput): Promise<Buffer> {
  /**
   * ⚠️ INTEROP, not a style choice. `gifenc` is CommonJS: under ESM its named
   * exports arrive on `.default`, and destructuring them directly gives
   * `quantize is not a function` at the moment of encoding — not at import,
   * which is what makes it confusing. The same is true of `upng-js`.
   */
  const gifencMod = await import("gifenc");
  const { GIFEncoder, quantize, applyPalette } = gifencMod.default ?? gifencMod;
  const upngMod = await import("upng-js");
  const UPNG = upngMod.default ?? upngMod;

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
    p.on("close", (code) =>
      code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}: ${stderr.slice(-1200)}`)),
    );
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
     * ⛔ NORMALISED, NOT ATTENUATED — and that was a correction. A flat
     * -18dB sounded right in the abstract and measured -46dB mean, which is
     * nearly inaudible to somebody who deliberately unmutes. These files are
     * already quiet ambient recordings (-28 to -30dB), so shifting them down
     * buries them. ⚠️ They also differ from each other by 2.3dB, so any fixed
     * shift gives a different result depending on which one the recipe picks.
     *
     * ⇒ `loudnorm` targets a LEVEL instead: -26 LUFS is present-but-under,
     * and it lands there whichever track is chosen.
     *
     * ⚠️ FADED AT BOTH ENDS regardless. A bed that arrives at full volume is
     * a jump-scare on a post about a bad night, and one that stops dead is
     * worse.
     *
     * ⚠️ `-shortest` so the track is cut to the video and never the other way
     * round: the source files are five minutes long.
     */
    const seconds = input.holdMs.reduce((a, b) => a + b, 0) / 1000;
    const audio = input.audioPath
      ? [
          "-i", input.audioPath,
          "-filter_complex",
          `[1:a]loudnorm=I=-26:TP=-2:LRA=7,afade=t=in:st=0:d=1.2,afade=t=out:st=${Math.max(0, seconds - 1.5).toFixed(2)}:d=1.5[a]`,
          "-map", "0:v",
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
      ...audio,
      "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2,fps=25,format=yuv420p",
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
