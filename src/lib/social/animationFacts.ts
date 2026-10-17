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

export type AnimationFormat = "gif" | "mp4";

/**
 * ⛔ An animated GIF animates on X and NOWHERE ELSE. LinkedIn strips the
 * animation and posts the first frame; Facebook converts it, often to a still.
 * It is the format people ask for and the one that works least.
 */
export const ANIMATES_ON: Record<AnimationFormat, { yes: string[]; no: string[] }> = {
  mp4: { yes: ["facebook", "linkedin", "instagram", "x"], no: ["youtube"] },
  gif: { yes: ["x"], no: ["facebook", "linkedin", "instagram", "youtube"] },
};

/** Said in the schedule form BEFORE saving, never discovered after posting. */
export function animationWarning(format: AnimationFormat, platforms: string[]): string | null {
  const stills = platforms.filter((p) => ANIMATES_ON[format].no.includes(p));
  if (stills.length === 0) return null;
  return format === "gif"
    ? `⛔ ${stills.join(" and ")} will show this as a still image — those platforms strip GIF ` +
        `animation. Short video animates everywhere.`
    : `⚠️ ${stills.join(" and ")} will not play this as video.`;
}

export const MIME: Record<AnimationFormat, string> = {
  gif: "image/gif",
  mp4: "video/mp4",
};
