// src/lib/social/platformDialsStore.ts
// Reading the tuned dials. ⛔ The ONLY part of this feature that touches the
// database, and it is a separate file for that reason alone
// ⇒ src/lib/social/platformDials.ts.

import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { allCodeDials, dialsAreSane, type Dials, type DialSet } from "@/lib/social/platformDials";

export type LoadedDials = {
  dials: DialSet;
  /**
   * 🔑 WHAT WAS IGNORED AND WHY, carried rather than logged and forgotten.
   *
   * ⛔ A preference that lapses quietly is indistinguishable from a bug, and
   * the first symptom of a silently-dropped row would be posts that are the
   * wrong length with every check green ⇒ the relaxed-preference argument in
   * aPictureNeverComesRoundTwice.
   */
  notes: string[];
};

/**
 * The dials for every channel: the table where it has something sane to say,
 * the code everywhere else.
 *
 * ⚠️ NEVER THROWS, except for a programming error in `codeDials`. A tuning
 * table is a convenience; losing it must not stop the day's posts being
 * written.
 */
export async function loadDials(): Promise<LoadedDials> {
  const dials = allCodeDials();
  const notes: string[] = [];

  let rows: Record<string, unknown>[] = [];
  try {
    const db = getSupabaseAdmin();
    const { data, error } = await db
      .from("social_platform_dials")
      .select("platform, body_min, body_max, hashtags, emoji, tags_drive_discovery");
    if (error) {
      // ⚠️ Said once, plainly, and the code values are used. The most likely
      // cause is the SQL file not having been applied yet.
      notes.push(`The tuning table could not be read (${error.message}), so the built-in values are in use.`);
      return { dials, notes };
    }
    rows = (data ?? []) as Record<string, unknown>[];
  } catch (e) {
    notes.push(`The tuning table could not be reached (${(e as Error).message}), so the built-in values are in use.`);
    return { dials, notes };
  }

  for (const row of rows) {
    const platform = String(row.platform ?? "");
    // ⛔ A row for a channel the code no longer has is ignored, not an error.
    if (!Object.hasOwn(dials, platform)) {
      notes.push(`The tuning table has a row for "${platform}", which is not a channel any more. Ignored.`);
      continue;
    }
    const candidate: Dials = {
      bodyTarget: { min: Number(row.body_min), max: Number(row.body_max) },
      hashtags: Number(row.hashtags),
      emoji: Number(row.emoji),
      tagsDriveDiscovery: row.tags_drive_discovery === true,
    };
    if (!dialsAreSane(candidate)) {
      notes.push(
        `The tuned dials for ${platform} are out of range ` +
          `(${candidate.bodyTarget.min}–${candidate.bodyTarget.max} characters, ` +
          `${candidate.hashtags} tags, ${candidate.emoji} emoji), so the built-in values are in use for it.`,
      );
      continue;
    }
    dials[platform] = candidate;
  }

  return { dials, notes };
}
