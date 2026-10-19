// src/lib/social/platformDials.ts
// The per-channel editorial dials, read from the database, falling back to code.
//
// 🔑 THE OWNER'S QUESTION, 19 Oct: are the per-platform rules in the database
// "for continual fine tuning"? They were not — every number was a literal in
// platforms.ts, so acting on a measurement meant shipping a build, and a
// number that needs a deploy is a number nobody changes.
//
// ⛔ ONLY THE DIALS MOVE. `PlatformSpec` also holds platform FACTS — the 2,200
// character Instagram ceiling, "Instagram has no text-only post", "a link in a
// Facebook body costs the post its distribution". Those are not ours to tune
// and a wrong one stops a channel publishing, so they stay in code where
// changing one is a reviewed diff ⇒ docs/sql/social_platform_dials.sql.
//
// ⚠️ SYNCHRONOUS AT THE POINT OF USE, ON PURPOSE. `checkHouseStyle` and
// `buildPrompt` are pure functions with a great many tests; making them async
// so each could await a table would push a database into the writer's prompt
// builder. ⇒ The read happens once, where there is already an await, and the
// result is passed down.
//
// 🔴 AND NOTHING IN THIS FILE TOUCHES THE DATABASE, which is why the read
// lives in platformDialsStore.ts next door. `checkHouseStyle` imports this
// module, and a server-only import reached from a check that pure means the
// day something renders that check in the browser, the bundle pulls Supabase
// in with it. ⚠️ THIS REPO HAS ALREADY MADE THAT MISTAKE ONCE, with ffmpeg
// ⇒ "From animationFacts, not animate" in NewSchedule.tsx.

import { PLATFORMS, PLATFORM_IDS, type PlatformId } from "@/lib/social/platforms";

export type Dials = {
  bodyTarget: { min: number; max: number };
  hashtags: number;
  emoji: number;
  tagsDriveDiscovery: boolean;
};

export type DialSet = Record<string, Dials>;

/**
 * What the code says, which is the answer whenever the database cannot
 * improve on it.
 *
 * 🔑 THE CODE REMAINS THE DEFAULT RATHER THAN THE TABLE BEING THE TRUTH. A
 * missing table, an outage, a renamed channel or a nonsense row all land on a
 * value somebody reviewed. ⛔ The alternative — treating the table as
 * authoritative — means an empty table writes 0-character posts with 0 tags
 * and nothing anywhere says why.
 */
export function codeDials(platform: string): Dials {
  const spec = Object.hasOwn(PLATFORMS, platform) ? PLATFORMS[platform as PlatformId] : undefined;
  if (!spec) {
    /**
     * ⛔ NOT A SILENT DEFAULT FOR AN UNKNOWN CHANNEL. `checkHouseStyle`
     * already refuses a platform it does not know, loudly, and this must not
     * quietly hand it numbers that make the refusal look like a pass
     * ⇒ the `hasOwn` comment in voiceGate.
     */
    throw new Error(`platformDials: ${platform} is not a channel this product knows.`);
  }
  return {
    bodyTarget: { ...spec.bodyTarget },
    hashtags: spec.hashtags,
    emoji: spec.emoji,
    tagsDriveDiscovery: spec.tagsDriveDiscovery,
  };
}

/** Every channel, as the code has it. */
export function allCodeDials(): DialSet {
  return Object.fromEntries(PLATFORM_IDS.map((id) => [id, codeDials(id)]));
}

/**
 * 🔴 WHY A ROW IS VALIDATED EVEN THOUGH THE TABLE HAS A CHECK CONSTRAINT.
 *
 * These numbers are read into a PROMPT. `hashtags = 400` throws nothing — it
 * instructs the writer to produce 400 hashtags, and then the gate, which
 * reads its ceiling from the SAME row, agrees that 400 is fine. Both halves
 * of the check move together, so neither catches it
 * ⇒ trap_a_guard_satisfied_by_a_neighbouring_value.
 *
 * ⚠️ The constraint stops the row existing; this stops a row that exists
 * anyway from being used — a table restored from a backup taken before the
 * constraint, or a column widened by a later migration. ⛔ A rejected row
 * falls back to the code value for that channel alone, not for all of them.
 */
export function dialsAreSane(d: Dials): boolean {
  const ints = [d.bodyTarget.min, d.bodyTarget.max, d.hashtags, d.emoji];
  if (!ints.every((n) => Number.isInteger(n))) return false;
  if (typeof d.tagsDriveDiscovery !== "boolean") return false;
  if (d.bodyTarget.min < 40 || d.bodyTarget.min > 2_000) return false;
  if (d.bodyTarget.max <= d.bodyTarget.min || d.bodyTarget.max > 3_000) return false;
  if (d.hashtags < 0 || d.hashtags > 10) return false;
  if (d.emoji < 0 || d.emoji > 5) return false;
  return true;
}

