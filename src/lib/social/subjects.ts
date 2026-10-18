// src/lib/social/subjects.ts
// Where a subject comes from, and how "always unique" is made true rather than
// requested.
//
// ⛔ THE THING THIS FILE REFUSES TO DO. Ask the model for "something new". A
// model told to avoid repeating itself repeats itself inside a fortnight,
// confidently, and the repetition is only visible to somebody scrolling the
// page. Uniqueness has to be checked against a record of what was actually
// posted — which is why `social_topics_used` has a unique index and this module
// has no cleverness in it at all.

import { createHash } from "crypto";

/**
 * 🔑 THE POOLS MOVED OUT ⇒ src/lib/social/topicPools.ts, because this file
 * imports `crypto` and the schedule form therefore could not read them — so it
 * kept a hand-written copy, which is exactly how `short_video` and
 * `animated_gif` ended up unreachable. Re-exported here so every existing
 * caller keeps working.
 */
export { TOPIC_POOLS, TOPIC_POOL_IDS, type TopicPool } from "@/lib/social/topicPools";

/**
 * Normalise before hashing, so that trivial differences collide.
 *
 * ⚠️ Without this, "The 22 languages" and "the 22 languages." are two distinct
 * rows and the register is decorative. Normalisation is the part that makes the
 * unique index mean what it looks like it means.
 */
export function normaliseSubject(subject: string): string {
  return subject
    .toLowerCase()
    .normalize("NFKC")
    // ⚠️ Only the SINGLE quotes fold to an apostrophe. Folding the curly
    // doubles here too left “22” as '22' — which the class below keeps, because
    // it keeps apostrophes — so a quoted subject hashed differently from the
    // same subject unquoted. Double quotes are punctuation and are dropped by
    // the next line like every other mark.
    .replace(/[‘’]/g, "'")
    .replace(/[^\p{L}\p{N}\s']/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function subjectHash(subject: string): string {
  return createHash("sha256").update(normaliseSubject(subject)).digest("hex").slice(0, 32);
}

/** Words carried by almost every subject, which would make everything look similar. */
const STOP_WORDS = new Set([
  "the", "a", "an", "and", "or", "of", "to", "in", "on", "for", "with", "is",
  "it", "that", "this", "what", "why", "how", "you", "your", "we", "our", "not",
  "no", "at", "as", "by", "be", "are", "was", "were", "from", "about", "its",
]);

function contentTokens(subject: string): Set<string> {
  return new Set(
    normaliseSubject(subject)
      .split(" ")
      .filter((w) => w.length > 2 && !STOP_WORDS.has(w)),
  );
}

/**
 * How much two subjects overlap, 0 to 1, ignoring the words every subject has.
 *
 * 🔑 WHY A HASH IS NOT ENOUGH. "Odia, and the people who think in it" and
 * "The people who think in Odia" are different strings, hash differently, and
 * are the same post. A unique index cannot see that; this can.
 */
export function subjectOverlap(a: string, b: string): number {
  const ta = contentTokens(a);
  const tb = contentTokens(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  let shared = 0;
  for (const t of ta) if (tb.has(t)) shared++;
  return shared / Math.min(ta.size, tb.size);
}

/**
 * At what overlap two subjects are the same post wearing a different sentence.
 *
 * ⚠️ 0.6 was chosen by trying it against the real pools rather than picked as a
 * round number: "the 22 languages" against "eleven of the 22 languages are
 * Indian" lands at 0.5 and is genuinely a different post; the Odia pair above
 * lands at 1.0. Anything at or above this is rejected and rewritten.
 */
export const OVERLAP_LIMIT = 0.6;

export type SubjectVerdict =
  | { ok: true }
  | { ok: false; reason: string; clashesWith: string };

/**
 * Is this subject genuinely new, given everything already used?
 *
 * `recent` should be the most recent few hundred subjects. ⛔ Not all of them
 * forever: the overlap check is O(n) per candidate and the point of the window
 * is to catch a model circling, which it does within weeks, not years. Exact
 * repeats at any distance are caught by the unique index regardless.
 */
export function judgeSubject(subject: string, recent: string[]): SubjectVerdict {
  const trimmed = subject.trim();
  if (trimmed.length < 8) {
    return { ok: false, reason: "too short to be a subject", clashesWith: "" };
  }

  const hash = subjectHash(trimmed);
  for (const r of recent) {
    if (subjectHash(r) === hash) {
      return { ok: false, reason: "this exact subject has been used", clashesWith: r };
    }
  }
  for (const r of recent) {
    const overlap = subjectOverlap(trimmed, r);
    if (overlap >= OVERLAP_LIMIT) {
      return {
        ok: false,
        reason: `${Math.round(overlap * 100)}% of the meaningful words are shared with a subject already used`,
        clashesWith: r,
      };
    }
  }
  return { ok: true };
}

/**
 * The exclusion list handed to the writer.
 *
 * ⚠️ This is a HELP, not the guarantee. Telling the model what not to repeat
 * makes it less likely to try; `judgeSubject` and the unique index are what
 * make it impossible. ⛔ Never move the guarantee into the prompt.
 */
export function exclusionList(recent: string[], limit = 200): string[] {
  return recent.slice(0, limit);
}
