// src/lib/social/animationFacts.ts
// What each animated format does on each channel. No encoders, no node.
//
// 🔴 THIS FILE EXISTS BECAUSE THE SCHEDULE FORM NEEDS ONE SENTENCE FROM IT.
// `animate.ts` imports child_process, fs and the ffmpeg binary — so a client
// component importing `animationWarning` from there dragged the entire encoder,
// and a 70MB binary, into the browser bundle. The build failed; had it not, it
// would have shipped.
//
// ⚠️ The general shape: a fact a UI needs and a machine that acts on it are two
// modules. Putting them together is convenient right up until something that
// runs in a browser needs the fact.
import { PLATFORMS } from "@/lib/social/platforms";

export type AnimationFormat = "gif" | "mp4";

/**
 * ⛔ An animated GIF animates on X and NOWHERE ELSE. LinkedIn strips the
 * animation and posts the first frame; Facebook converts it, often to a still.
 * It is the format people ask for and the one that works least.
 */
export const ANIMATES_ON: Record<AnimationFormat, { yes: string[]; no: string[] }> = {
  /**
   * 🔴 YOUTUBE MOVED FROM `no` TO `yes` ON 19 Oct, and the old entry was absurd
   * by then: YouTube is the one channel that is NOTHING BUT video.
   *
   * ⛔ It was written when "YouTube" here meant a COMMUNITY POST, which cannot
   * carry a video — and which the Data API cannot create at all. The format
   * became Shorts; this sentence did not follow, and so the schedule form
   * warned "YouTube Shorts will not play this as video" on the only shape
   * YouTube accepts ⇒ trap_a_sentence_that_states_the_world_goes_stale.
   *
   * ⚠️ The FOURTH stale YouTube fact found in one evening, all rooted in that
   * same dead assumption — the others being the recorded blocker, the voice,
   * and the 1280×720 card.
   */
  mp4: { yes: ["facebook", "linkedin", "instagram", "x", "youtube"], no: [] },
  gif: { yes: ["x"], no: ["facebook", "linkedin", "instagram", "youtube"] },
};

/** Said in the schedule form BEFORE saving, never discovered after posting. */
export function animationWarning(format: AnimationFormat, platforms: string[]): string | null {
  const stills = platforms.filter((p) => ANIMATES_ON[format].no.includes(p));
  if (stills.length === 0) return null;

  /**
   * ⚠️ READ ALOUD BEFORE SHIPPING, which is how these two came out.
   *
   * It said "facebook will show this as a still image — those platforms strip
   * GIF animation": the channel's id rather than its name, and a plural about
   * one of them. Small, and it is the sentence standing between an admin and a
   * post that does not move.
   */
  // ⚠️ Indexed by a plain string, because these ids arrive from a form. An
  // unknown one falls back to itself rather than throwing.
  const labels = PLATFORMS as Record<string, { label: string } | undefined>;
  const named = stills.map((p) => labels[p]?.label ?? p);
  const list =
    named.length === 1
      ? named[0]
      : `${named.slice(0, -1).join(", ")} and ${named[named.length - 1]}`;
  const they = named.length === 1 ? "it strips" : "they strip";

  return format === "gif"
    ? `⛔ ${list} will show this as a still image — ${they} GIF animation. ` +
        `Short video animates everywhere.`
    : `⚠️ ${list} will not play this as video.`;
}

export const MIME: Record<AnimationFormat, string> = {
  gif: "image/gif",
  mp4: "video/mp4",
};
