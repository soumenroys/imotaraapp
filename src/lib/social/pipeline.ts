// src/lib/social/pipeline.ts
// The run: subject → words → gate → picture → queue.
//
// 🔑 EVERY DEPENDENCY IS INJECTED. The registers, the writer and the random
// choice all arrive as functions, so the whole flow — including "the gate
// rejected three drafts and the fourth passed" and "auto-publish was asked for
// in a language nobody reads" — is testable without a database, a model or a
// network. That is not a testing nicety: this is the code that decides what
// goes out in the company's name, and it has to be exercisable.
//
// ⛔ A HAND-WRITTEN POST COMES THROUGH HERE TOO. `prepareWritten` skips the
// writer and nothing else. Writing it yourself is a different way in, never a
// way round.

import { assertPostableLanguage } from "@/lib/social/languages";
import type { ContentType } from "@/lib/social/contentTypes";
import {
  checkVoice,
  checkHouseStyle,
  canAutoPublishIn,
  type GateOverlay,
  type GateResult,
  type HouseStyleResult,
} from "@/lib/social/voiceGate";
import { judgeSubject, subjectHash, exclusionList } from "@/lib/social/subjects";
import { pickRecipe, headlineFor, supportFromBody, type Recipe } from "@/lib/social/visualRecipe";
import { unshapableScripts, unshapableNote } from "@/lib/social/shaping";
import { pickWord, untranslatablePoolReady, vettedWords } from "@/lib/social/untranslatableWords";
import { angleScores, turnsFor, weightedCycle, type PostOutcome } from "@/lib/social/learning";
import {
  pickMistake,
  mistakesPoolReady,
  mentionsMistake,
  vettedMistakes,
  type ProductMistake,
} from "@/lib/social/productMistakes";
import { composePicture, type Picture } from "@/lib/social/compose";
import { eyebrowFor, TOPIC_POOLS } from "@/lib/social/topicPools";
import { shapeFor, mixProblems } from "@/lib/social/contentMix";
import type { Dials } from "@/lib/social/platformDials";
import { platformSpec } from "@/lib/social/platforms";
import { allQrCodes, QR_COUNT, type QrCode } from "@/lib/social/brandMarks";

// ⚠️ Re-exported, not declared. The list lives in contentTypes.ts so a client
// component can read it without pulling `crypto` through visualRecipe.
export { CONTENT_TYPES, type ContentType } from "@/lib/social/contentTypes";

export type ScheduleShape = {
  id: string;
  name: string;
  brief: string;
  platforms: string[];
  contentType: ContentType;
  /**
   * 🔑 SEVERAL SHAPES, ROTATED ONE PER POST ⇒ contentMix.ts. The owner, 19
   * Oct: "randomly mix text+graphics and videos in content."
   *
   * ⛔ NULL MEANS `contentType` FOR EVERY POST, which is every schedule
   * written before that. A new column must not change what existing
   * schedules produce.
   */
  contentMix?: string[] | null;
  topicPool: string[];
  tone: string;
  lengthHint: string;
  languages: string[];
  autoPublish: boolean;
};

export type WriteRequest = {
  brief: string;
  tone: string;
  lengthHint: string;
  language: string;
  /** ⚠️ The channel the post is FOR. Its register and its ceiling differ, and
   *  a LinkedIn post written to Facebook's shape reads as the wrong room. */
  platform?: string;
  topicPool: string[];
  /**
   * ⚠️ The SHAPE being written, because a carousel needs a different reply
   * from the model — several cards, not one body ⇒ responseShape.
   */
  contentType?: ContentType;
  /** Subjects the writer must not use again. ⚠️ A help, never the guarantee. */
  avoid: string[];
  /**
   * 🔑 THE TUNED EDITORIAL DIALS for this channel ⇒ platformDials.ts, so a
   * measurement can change what the writer is TOLD without a deploy.
   *
   * ⛔ OPTIONAL, FALLING BACK TO THE CODE. The dials are a convenience; if
   * the table cannot be read the post is still written, to the reviewed
   * built-in numbers ⇒ loadDials never throws.
   *
   * ⚠️ AND THE WRITER MUST BE TOLD, not merely constrained. A limit the model
   * cannot see is a hope ⇒ trap_a_constraint_nobody_told_the_writer — which
   * is the whole reason these numbers are in the prompt at all.
   */
  dials?: Dials;
  /** On a retry, what the gate objected to last time. */
  previousObjections?: string[];
  /**
   * The word this post must be about, when the angle is the untranslatable
   * one.
   *
   * 🔑 CHOSEN HERE RATHER THAN INSIDE THE WRITER, so that the thing which
   * sent the instruction is also the thing that can CHECK the result. The
   * writer used to pick it from a seed; nothing could then verify the post
   * was about it, because nobody else knew which word had been handed over
   * ⇒ src/lib/social/untranslatableWords.ts.
   */
  word?: { word: string; roman: string; language: string; meaning: string };
  /**
   * The real, confirmed mistake this post must be about, when the angle is the
   * "something we got wrong" one.
   *
   * ⛔ Never invented. The model has no access to the product's history and
   * produced a plausible one the first time it was asked
   * ⇒ src/lib/social/productMistakes.ts.
   */
  mistake?: ProductMistake;
};

export type Written = {
  subject: string;
  body: string;
  support?: string;
  /**
   * 🔑 The cards AFTER the subject, when the shape is a carousel.
   * ⛔ Asked of the writer, never cut out of `body` — splitting on sentence
   * ends changes how many cards publish the moment an abbreviation or a
   * decimal appears ⇒ docs/sql/social_carousel.sql.
   */
  slides?: string[];
};

export type PipelineDeps = {
  recentSubjects: () => Promise<string[]>;
  /**
   * 🔑 HOW MANY POSTS EACH HAND-FED ANGLE HAS ALREADY SPENT.
   *
   * ⚠️ Needed because those angles have FINITE MATERIAL: a confirmed word, a
   * real mistake. Without it the rotation keeps offering an angle whose only
   * word has been used, and the writer dutifully writes about it again.
   */
  poolUsage: () => Promise<Record<string, number>>;
  /**
   * 🔑 THE ANGLES ALREADY SPENT ON THE DAY THIS POST IS FOR, on EVERY channel.
   *
   * ⚠️ OPTIONAL, and omitting it changes nothing — every existing caller and
   * every test behaves exactly as before. ⛔ Which also means the wiring must
   * be pinned by a test that calls the real route, or this is a correct
   * function nothing invokes ⇒ trap_text_assertions_cannot_see_reachability.
   */
  poolsUsedOn?: (scheduledForISO: string) => Promise<string[]>;
  /**
   * 🔑 WHAT EACH PAST POST ACTUALLY EARNED, so the next one can be chosen with
   * that in mind ⇒ src/lib/social/learning.ts. The owner: "actions are taken
   * for the next post automatically."
   *
   * ⛔ Returns [] when there is nothing measured, and the rotation is then
   * EXACTLY the round-robin it has always been. Doing nothing is the correct
   * behaviour on no evidence, and it is the behaviour today.
   */
  measuredPosts: () => Promise<PostOutcome[]>;
  /**
   * 🔑 THE TUNED EDITORIAL DIALS, per channel ⇒ platformDialsStore.loadDials.
   *
   * ⚠️ A DEPENDENCY LIKE THE REST, so the tests that assert a post's length or
   * its tag count keep running against the reviewed built-in numbers rather
   * than against whatever is in the database today. ⛔ A test whose
   * expectations can be changed by a row is not a test.
   */
  dials?: () => Promise<{ dials: Record<string, Dials>; notes: string[] }>;
  usedRecipeHashes: () => Promise<Set<string>>;
  recentPalettes: () => Promise<string[]>;
  recentLayouts: () => Promise<string[]>;
  overlay: () => Promise<GateOverlay>;
  write: (req: WriteRequest) => Promise<Written>;
  rng?: () => number;
  /** ⚠️ Not unlimited: a writer that cannot produce a clean draft in three
   *  tries has a problem the fourth attempt will not fix, and each try costs. */
  maxAttempts?: number;
};

export type RejectedDraft = {
  attempt: number;
  subject: string;
  body: string;
  why: string;
  gate?: GateResult;
};

/**
 * 🔴 THE REFUSAL, WITH THE REASONS ATTACHED — added 20 Oct 2026.
 *
 * ⛔ `prepareGenerated`'s refusal says "the objections are recorded against
 * each attempt so the brief can be fixed". **They were not.** It returned
 * them on `rejected` and the queue cron stored only the summary, so the one
 * sentence telling an operator where to look pointed at nothing
 * ⇒ trap_a_sentence_that_states_the_world_goes_stale.
 *
 * 🔑 Found on four Instagram slots that failed three drafts out of three and
 * left no evidence of why. Two recovered on a later retry, which makes it
 * INTERMITTENT — the kind of failure that cannot be diagnosed afterwards
 * unless the reason was kept at the time.
 *
 * ⚠️ THE SUBJECT AND BODY ARE DELIBERATELY LEFT OUT. The objection is what is
 * actionable, and copying rejected drafts into a failure row would put
 * ungated words somewhere nobody is expecting to find them.
 */
export function failureDetail(reason: string, rejected: RejectedDraft[]): string {
  const why = rejected.map((r) => `#${r.attempt}: ${r.why}`).join(" | ");
  return why ? `${reason} ⇒ ${why}` : reason;
}

export type PreparedPost = {
  origin: "generated" | "written";
  scheduleId: string | null;
  authorId: string | null;
  platform: string;
  language: string;
  subject: string;
  subjectHash: string;
  body: string;
  support?: string;
  status: "needs_review" | "approved";
  mediaKind: "none" | "graphic" | "animated_gif" | "short_video" | "carousel";
  /**
   * 🔑 The cards AFTER the subject, for a carousel. ⛔ Written by the model,
   * gated word by word like everything else, and NEVER cut out of `body`.
   */
  slides?: string[];
  /**
   * 🔑 WHICH ANGLE THIS CAME FROM, carried so it can be STORED.
   *
   * ⛔ It was chosen by nextPool, handed to the writer, and dropped on the
   * floor — which made "which angle actually lands?" unanswerable, and that is
   * the question the rotation exists to let somebody ask.
   */
  topicPool?: string;
  picture: Picture | null;
  recipe: Recipe | null;
  gate: GateResult;
  houseStyle: HouseStyleResult;
  /** Everything the reviewer should see: substituted wordmarks, relaxed
   *  preferences, why it is waiting rather than publishing. */
  notes: string[];
  rejected: RejectedDraft[];
};

export type PrepareResult =
  | { ok: true; post: PreparedPost }
  | { ok: false; reason: string; rejected: RejectedDraft[] };

/**
 * Which language this schedule writes in next.
 *
 * 🔑 ROTATION, not random. Random repeats and clusters — three Bengali posts in
 * a week and then nothing for a month — and on a page with our follower counts
 * that reads as neglect of the other languages rather than as chance.
 *
 * ⛔ Throws on an empty list rather than defaulting. A schedule that quietly
 * fell back to English would post in the wrong language for months and look
 * entirely healthy ⇒ trap_concretelang_turns_auto_into_en.
 */
export function nextLanguage(languages: string[], postsSoFar: number): string {
  if (!languages || languages.length === 0) {
    throw new Error(
      "social/pipeline: this schedule has no language. There is no default — " +
        "English would be a silent wrong answer rather than a visible failure.",
    );
  }
  if (postsSoFar < 0 || !Number.isFinite(postsSoFar)) {
    throw new Error(`social/pipeline: postsSoFar must be a non-negative number, got ${postsSoFar}`);
  }
  return languages[postsSoFar % languages.length];
}

/**
 * Which angle this post takes.
 *
 * 🔴 THE MODEL USED TO CHOOSE, AND IT CHOSE THE SAME THING EVERY TIME.
 *
 * The prompt listed every pool the schedule had and said "CHOOSE ONE OF THESE
 * ANGLES". On 18 Oct three pools were added specifically because the first
 * seven are all product explanation and product explanation does not travel —
 * and then three posts in a row came back about privacy, about memory, and
 * about having no streaks. The new angles were offered every time and never
 * taken.
 *
 * ⚠️ THE GENERAL SHAPE, which is worth more than this fix: a menu handed to a
 * model is not a rotation. It will pick the safest item on it, consistently,
 * and the variety you think you configured never happens. Languages were
 * always rotated in code for exactly this reason ⇒ nextLanguage. The angle is
 * now rotated the same way.
 *
 * ⛔ Throws rather than defaulting. A schedule with no pool is a schedule
 * nobody finished setting up, and picking one for them hides that.
 */
/**
 * The pools that can actually produce a post today.
 *
 * 🔴 AN ANGLE WITH NOTHING BEHIND IT IS WORSE THAN A MISSING ANGLE. If the
 * untranslatable pool is in a schedule and no word has been confirmed, the
 * rotation would land on it every fifth post and the writer would have
 * nothing to write from — so it is removed from the cycle rather than left in
 * it to fail ⇒ src/lib/social/untranslatableWords.ts.
 *
 * ⚠️ Filtering BEFORE the rotation, not after: dropping it afterwards would
 * silently shift every other pool's turn.
 */
/**
 * Did the post actually use the word it was given?
 *
 * ⚠️ Either the script or the romanisation counts. A post may reasonably
 * write "abhimaan" for readers who do not read Bengali, and demanding the
 * script would reject a perfectly good post — while demanding neither is no
 * check at all.
 */
export function bodyUsesWord(text: string, word: { word: string; roman: string }): boolean {
  return text.includes(word.word) || text.toLowerCase().includes(word.roman.toLowerCase());
}

/**
 * 🔴 AN ANGLE WITH FINITE MATERIAL RUNS OUT, AND MUST THEN STAND DOWN.
 *
 * `untranslatable` and `built-wrong` are not angles the model may invent
 * within — each is handed a specific vetted thing, because the first time
 * either chose for itself it was WRONG: an invented gloss for a Tamil word, an
 * invented history that never happened.
 *
 * ⛔ SO THE MATERIAL IS THE LIMIT. One confirmed word is ONE POST.
 * untranslatableWords.ts says exactly that and expected the subject register
 * to enforce it — "the angle quietly stops being available rather than
 * publishing the same thought twice".
 *
 * 🔴 IT DID NOT. With one confirmed word, ten days of queue came out carrying
 * FOUR posts about অভিমান:
 *     "Abhimaan: the hurt that waits to be noticed"
 *     "Abhimaan: when pride feels tender"
 *     "Abhimaan: the quiet sulk that waits to be met"
 *     "Abhimaan: the sulk that asks to be seen"
 * Four different subjects, so the overlap check passed every time — and the
 * same post four times, which is what a reader actually sees.
 *
 * ⚠️ A CHECK ON WORDING CANNOT SEE SAMENESS OF SUBSTANCE. Counting what the
 * angle has spent can, and it is not a judgement call.
 */
export function usablePools(
  pools: string[],
  used: Record<string, number> = {},
  /**
   * How much material each finite angle has. ⚠️ INJECTABLE ONLY SO THE RULE
   * CAN BE TESTED. `built-wrong` has nothing confirmed today, so its
   * exhaustion branch is unreachable through the real counts — a mutation
   * deleting it survived, correctly, because `mistakesPoolReady()` already
   * drops the angle. ⛔ A rule that cannot be exercised is a rule nobody will
   * notice breaking on the day somebody confirms the first mistake.
   */
  limits: Record<string, number> = {
    untranslatable: vettedWords().length,
    "built-wrong": vettedMistakes().length,
  },
  /**
   * 🔑 THE CHANNEL, so an angle whose SHAPE this channel cannot publish is
   * dropped rather than posted in the wrong form.
   *
   * ⛔ `ways-of-saying` is a carousel or it is nothing — as a single card it
   * is six lines of small type. Facebook takes multi-photo posts by a route
   * nothing has been built for ⇒ mediaPlan.ts, so on Facebook this angle must
   * stand down, not degrade.
   *
   * ⚠️ OPTIONAL, and omitting it drops nothing — every caller that does not
   * care about shape behaves exactly as before.
   */
  platform?: string,
): string[] {
  /**
   * 🔑 ONE RULE, NOT TWO. "Nothing is confirmed" and "everything confirmed
   * has been used" are the same question — IS THERE UNUSED MATERIAL LEFT? —
   * and `used >= limit` answers both: with nothing confirmed the limit is 0,
   * and 0 >= 0 drops the angle exactly as the readiness check did.
   *
   * ⛔ WRITTEN AS TWO CHECKS JOINED BY `||`, the readiness half short-circuited
   * and the exhaustion half could never run while nothing was confirmed — so a
   * mutation deleting it survived, and the rule would have failed silently on
   * the day somebody confirmed the first mistake. ⚠️ Measured, not reasoned.
   *
   * ⚠️ The REASON an angle stood down is a separate question from whether it
   * did ⇒ standDownReasons, below. Two places deciding the same thing is how
   * the readiness check and the exhaustion check drifted apart in the first
   * place; one decides, the other explains.
   */
  return pools.filter((p) => {
    // ⛔ Shape first: an angle this channel cannot carry is unavailable
    // however much material it has left.
    if (platform) {
      const shape = TOPIC_POOLS.find((t) => t.id === p)?.shape;
      if (shape && mixProblems([shape], [platform]).length > 0) return false;
    }
    const limit = limits[p];
    if (limit === undefined) return true; // open-ended: a direction, not material
    return (used[p] ?? 0) < limit;
  });
}

/**
 * Why each angle the schedule asked for is not available, in words.
 *
 * 🔴 BECAUSE AN ANGLE THAT SILENTLY NEVER APPEARS IS INDISTINGUISHABLE FROM
 * ONE THAT IS SIMPLY UNLUCKY. `untranslatablePoolReady()` and
 * `mistakesPoolReady()` have carried a careful explanation since they were
 * written, and until now NOTHING READ IT — I nearly left a comment in this
 * file claiming the admin showed it, which it did not.
 *
 * ⚠️ Explains, never decides ⇒ usablePools is the gate.
 */
export function standDownReasons(
  pools: string[],
  used: Record<string, number> = {},
  limits: Record<string, number> = {
    untranslatable: vettedWords().length,
    "built-wrong": vettedMistakes().length,
  },
): { pool: string; why: string }[] {
  const left = new Set(usablePools(pools, used, limits));
  const out: { pool: string; why: string }[] = [];

  for (const pool of pools) {
    if (left.has(pool)) continue;
    const spent = used[pool] ?? 0;
    const limit = limits[pool] ?? 0;

    if (limit === 0) {
      // Nothing was ever confirmed — the angle has never been available.
      const reason =
        pool === "untranslatable" ? untranslatablePoolReady().reason : mistakesPoolReady().reason;
      out.push({ pool, why: reason ?? `${pool} has no confirmed material.` });
      continue;
    }

    out.push({
      pool,
      why:
        `“${pool}” has used all ${limit} of its confirmed entries (${spent} post(s) written), so it ` +
        `stands down rather than writing about the same one again. ⚠️ Four posts about অভিমান reached ` +
        `one ten-day queue before this rule existed. ▶️ Confirm another entry to give it legs.`,
    });
  }
  return out;
}

/**
 * 🔴 THE DAY, IN KOLKATA, AS A UTC WINDOW — added 20 Oct 2026.
 *
 * ⛔ India has NO daylight saving, so the offset is a constant and this needs
 * no timezone database. ⚠️ That is a fact about India, not a shortcut: the
 * same arithmetic would be wrong for a schedule in a DST country, so the
 * constant is named rather than inlined.
 */
export const IST_OFFSET_MS = 5.5 * 3_600_000;

export function istDayWindow(iso: string): { from: string; to: string } {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) {
    throw new Error(`social/pipeline: istDayWindow needs a real date, got ${iso}`);
  }
  const dayStart = Math.floor((t + IST_OFFSET_MS) / 86_400_000) * 86_400_000;
  return {
    from: new Date(dayStart - IST_OFFSET_MS).toISOString(),
    to: new Date(dayStart + 86_400_000 - IST_OFFSET_MS).toISOString(),
  };
}

/**
 * 🔴 THE ANGLES THIS DAY HAS NOT SPENT YET, ACROSS EVERY CHANNEL.
 *
 * ⛔ THE DEFECT THIS CLOSES, measured 20 Oct 2026. The rotation counter is
 * `postCountFor(schedule.id)` — **per schedule**. Facebook's and YouTube's
 * pools are character-for-character identical, so the two walk the same cycle
 * and land on the same angle on the same day, forever. The result went out
 * thirty minutes apart: "No names shared, unless you switch it on" on YouTube
 * at 18:30 and "No sync unless you choose it" on Instagram at 19:00.
 *
 * ⚠️ AND THE SUBJECT GUARD CANNOT SEE IT. `judgeSubject` is global, but it
 * compares WORDS — those two share none of the meaningful ones, so the
 * overlap is near zero and both pass. ⇒ **a lexical check cannot catch a
 * semantic repeat**, and the writer never repeats a string; it paraphrases.
 *
 * 🔑 SO THE FIX IS AT THE ANGLE, NOT THE WORDING. Two posts from different
 * angles will differ; two from the same angle on the same day will rhyme
 * however they are phrased ⇒ trap_a_menu_handed_to_a_model_is_not_a_rotation.
 *
 * ⛔ IT NEVER RETURNS EMPTY. Dropping every angle would stop the channel
 * posting altogether — trading a repeat for a silence, which is strictly
 * worse and is exactly the failure `queueHealth` exists for. With nothing
 * left, the day's angles are allowed again and the subject guard still stands
 * behind it.
 */
export function poolsLeftForToday(available: string[], usedToday: string[]): string[] {
  const spent = new Set(usedToday);
  const left = available.filter((p) => !spent.has(p));
  return left.length > 0 ? left : available;
}

export function nextPool(pools: string[], postsSoFar: number): string {
  if (!pools || pools.length === 0) {
    throw new Error(
      "social/pipeline: this schedule has no topic pool, so there is nothing to write about. " +
        "⛔ No default — a silently chosen subject is how a brand ends up posting whatever the " +
        "model finds easiest.",
    );
  }
  if (postsSoFar < 0 || !Number.isFinite(postsSoFar)) {
    throw new Error(`social/pipeline: postsSoFar must be a non-negative number, got ${postsSoFar}`);
  }
  return pools[postsSoFar % pools.length];
}

/** Does this content type want a picture? */
export function wantsPicture(contentType: ContentType): boolean {
  return (
    contentType === "graphic" ||
    contentType === "text_graphic" ||
    // 🔑 A moving card is the same card: the still is composed first, and the
    // frames are that picture with parts hidden. Nothing extra is written.
    contentType === "animated_gif" ||
    contentType === "short_video" ||
    /**
     * 🔴 CAROUSEL WAS MISSING HERE, AND THAT MADE IT IMPOSSIBLE — found 19 Oct
     * by running the pipeline rather than reading it.
     *
     * ⛔ Without a picture `mediaKindFor` returns "none", and Instagram has no
     * text-only post, so every carousel draft was refused with "this draft
     * made no card". The shape had been selectable on the schedule form since
     * it was added and could never once have produced a post.
     *
     * ⚠️ AND THE AUTHOR KNEW: the comment on `mediaKindFor` says "a carousel
     * still needs the picture machinery — every card is rendered the same
     * way". The knowledge was one function away from the code that contradicts
     * it ⇒ trap_a_constraint_nobody_told_the_writer, in its third costume.
     */
    contentType === "carousel"
  );
}

/** Does this shape move? */
export function wantsAnimation(contentType: ContentType): boolean {
  return contentType === "animated_gif" || contentType === "short_video";
}

/** What the post's media_kind should be. */
export function mediaKindFor(contentType: ContentType, hasPicture: boolean): string {
  if (!hasPicture) return "none";
  if (contentType === "animated_gif") return "animated_gif";
  if (contentType === "short_video") return "short_video";
  /**
   * ⚠️ A carousel still needs the picture machinery — every card is rendered
   * the same way — so it only becomes a carousel once there IS one.
   * ⛔ Without this it would be stored as a plain graphic and publish as a
   * single card, silently losing every slide the writer produced.
   */
  if (contentType === "carousel") return "carousel";
  return "graphic";
}

async function buildPicture(
  deps: PipelineDeps,
  args: {
    language: string;
    subject: string;
    body: string;
    scheduleId: string | null;
    platform: string;
    /**
     * 🔑 THE POOL THIS POST WAS WRITTEN FROM ⇒ nextPool, for the card's
     * eyebrow ⇒ eyebrowFor. Null for a hand-written post, which has no pool
     * and stores none either.
     */
    topicPool: string | null;
  },
): Promise<{ picture: Picture | null; recipe: Recipe | null; notes: string[] }> {
  const notes: string[] = [];

  /**
   * 🔴 THE SAME QUESTION THE RENDERER ASKS, asked the same way.
   *
   * This called `headlineFromBody(body)` while the renderer calls
   * `headlineFor(subject, body)` — subject first, because the subject was
   * WRITTEN to be the headline. So two pieces of code disagreed about what
   * the headline is: one decided whether a card could exist, the other
   * decided what it would say.
   *
   * ⛔ The cost was not cosmetic. A post with a short subject and a long
   * opening sentence HAS a perfectly good headline, and was refused a card
   * anyway — which on a channel with no text-only post means refused
   * entirely. Three Instagram drafts died that way before anybody looked
   * ⇒ trap_a_constraint_nobody_told_the_writer.
   *
   * ⚠️ Same shape as the defect that put the Page's first public post out as
   * plain text: `headlineFor` was introduced to prefer the subject, and this
   * caller was never moved onto it.
   */
  const headline = headlineFor(args.subject, args.body);

  /**
   * 🔴 THE SAME REFUSAL THE RENDERER MAKES, MADE EARLIER.
   *
   * The renderer is the authority — it re-derives the headline from the words
   * at draw time ⇒ renderPicture.ts. But a post queued for a card that can
   * never be drawn is a post that fails at 17:00 with nobody watching, so the
   * same question is asked here, where the answer can still change a draft
   * ⇒ src/lib/social/shaping.ts.
   */
  const unshapable = headline ? unshapableScripts(headline) : [];
  if (unshapable.length > 0) {
    notes.push(`No picture: ${unshapableNote(unshapable, "The card's headline")}`);
    return { picture: null, recipe: null, notes };
  }

  if (!headline) {
    // ⛔ Not a truncated headline. Half a sentence on a card is worse than no
    // card, and the post still works as text.
    notes.push(
      "No picture: neither the subject nor the opening sentence is short enough to set as a " +
        "headline, and neither is truncated here — half a thought on a card reads worse than no " +
        "card. The post goes out as text.",
    );
    return { picture: null, recipe: null, notes };
  }

  const picked = pickRecipe({
    language: args.language,
    usedHashes: await deps.usedRecipeHashes(),
    recentPalettes: await deps.recentPalettes(),
    recentLayouts: await deps.recentLayouts(),
    rng: deps.rng,
  });

  if (!picked.ok) {
    notes.push(`No picture: ${picked.reason}`);
    return { picture: null, recipe: null, notes };
  }

  notes.push(...picked.relaxed);

  /**
   * The QR, on every channel whose spec asks for one ⇒ platforms.ts.
   *
   * 🔴 THIS COMMENT SAID "⛔ Not on X or Instagram" AND THE DATA SAID
   * OTHERWISE. My reasoning was that a square in a phone feed is on the same
   * phone that would have to scan it; the owner overruled it, `qr` was set
   * true on all five channels, and the comment was left behind — so the file
   * read as if a rule were in force that nothing enforced.
   *
   * ⚠️ Same shape as the eight screens that said "nothing publishes yet" an
   * hour after it did ⇒ trap_a_sentence_that_states_the_world_goes_stale. A
   * comment that states the current configuration goes stale exactly like a
   * banner that states it.
   *
   * ⚠️ A failure to generate it must not lose the picture — a card without a
   * code is a card; no card at all is a text post nobody asked for.
   */
  const spec = platformSpec(args.platform);
  let qrCodes: QrCode[] = [];
  if (spec.qr) {
    qrCodes = await allQrCodes(args.platform);
    /**
     * 🔴 COMPARED AGAINST WHAT THIS CHANNEL ASKS FOR, NOT AGAINST THREE.
     *
     * ⛔ This read `qrCodes.length < 3` with the word "three" in the message —
     * and `QR_COUNT` gives **instagram and x ONE code each**, deliberately. So
     * on two of the five channels the warning fired on EVERY post, reporting a
     * complete success as a partial failure.
     *
     * ⚠️ Found on the first carousel ever generated, where it read "Only 1 of
     * the three QR codes could be made" — and 1 of 1 had been made.
     *
     * 🔑 A warning that cries wolf on a correct run is worse than no warning:
     * the next person learns to scroll past it, including the day it is true
     * ⇒ trap_a_sentence_that_states_the_world_goes_stale.
     */
    const wanted = QR_COUNT[args.platform] ?? qrCodes.length;
    if (qrCodes.length < wanted) {
      notes.push(
        `Only ${qrCodes.length} of the ${wanted} QR codes could be made. The picture is otherwise unchanged.`,
      );
    }
  }

  const picture = composePicture({
    recipe: picked.recipe,
    headline,
    /**
     * ⚠️ FROM THE POOL, NOT FROM THE RENDERER'S IMAGINATION. This is the same
     * agreement problem as the support line below: the recipe is chosen here
     * and the card is redrawn later from the stored row, so both must reach
     * the same eyebrow or the queued preview and the published card differ.
     */
    eyebrow: eyebrowFor(args.topicPool, args.language),
    /**
     * 🔴 FROM THE BODY, NOT FROM THE WRITER'S `support`.
     *
     * The writer is asked for a separate support line, and checkVoice never
     * reads it — the gate runs on `${subject}\n${body}`. Composing with it put
     * a sentence on the card that nothing had checked. It was never stored
     * either, so the render route drew its card from the body alone and the
     * two disagreed: the recipe was chosen against one set of words and the
     * published picture showed another.
     *
     * ⇒ One source for the card, and it is the one the word check read.
     */
    support: supportFromBody(args.body) ?? undefined,
    language: args.language,
    platform: args.platform,
    qrCodes,
  });
  notes.push(...picture.notes);

  return { picture, recipe: picked.recipe, notes };
}

/**
 * Decide the status a prepared post lands in.
 *
 * 🔑 THE SETTING THE OWNER ASKED FOR, and the one place it is read. OFF means
 * it waits in the review queue; ON means it posts unattended.
 *
 * ⛔ AND IT IS RE-CHECKED HERE, not trusted from the schedule row. The database
 * trigger refuses to store `auto_publish` with an unqualified language, and
 * this refuses to act on it — because the row could have been written before a
 * language was demoted, or by a path that predates the trigger. Two
 * independent checks of the same rule is the point, not duplication.
 */
export function decideStatus(
  autoPublish: boolean,
  language: string,
  overlay: GateOverlay,
): { status: "needs_review" | "approved"; note?: string } {
  if (!autoPublish) {
    return {
      status: "needs_review",
      note: "Waiting for you: this schedule does not publish without being read.",
    };
  }
  const verdict = canAutoPublishIn(language, overlay);
  if (!verdict.ok) {
    return {
      status: "needs_review",
      note:
        `Auto-publish is on for this schedule, but this post is held anyway. ${verdict.reason}`,
    };
  }
  return { status: "approved" };
}

/**
 * Generate one post for a schedule: the whole run, retries included.
 */
export async function prepareGenerated(
  deps: PipelineDeps,
  /**
   * ⚠️ `postsSoFar` decides the ANGLE, the same counter that decides the
   * language ⇒ nextPool. Passed in rather than counted here, because this
   * function does not read the database and three of its tests depend on that.
   */
  args: {
    schedule: ScheduleShape;
    platform: string;
    language: string;
    postsSoFar: number;
    /** When this post is FOR — the day whose angles must not be repeated. */
    scheduledFor?: string;
  },
): Promise<PrepareResult> {
  const language = assertPostableLanguage(args.language);
  const maxAttempts = deps.maxAttempts ?? 3;
  const [recent, overlay] = await Promise.all([deps.recentSubjects(), deps.overlay()]);
  const rejected: RejectedDraft[] = [];
  const objections: string[] = [];

  /**
   * 🔑 THE ANGLE AND ITS WORD ARE DECIDED ONCE, HERE, before any attempt.
   * Deciding them inside the loop would change the subject on a gate retry,
   * and deciding them inside the writer left nobody able to check the result
   * ⇒ the `word` field on WriteRequest.
   */
  /**
   * 🔴 THE ROTATION IS NOW TILTED BY WHAT WORKED, not replaced by it.
   *
   * ⛔ Every angle still gets a turn — "do more of what works" run to its
   * conclusion picks one angle and never leaves, which is the monoculture the
   * round-robin was built to prevent
   * ⇒ trap_a_menu_handed_to_a_model_is_not_a_rotation.
   *
   * ⚠️ And it does nothing until an angle has MIN_POSTS_PER_ANGLE measured
   * posts behind it on THIS channel ⇒ learning.ts. Today that is true of none
   * of them, so this line behaves exactly as the plain round-robin did.
   */
  /**
   * 🔑 THE TUNED DIALS, READ ONCE PER POST ⇒ platformDialsStore.loadDials. The
   * writer is TOLD them and the house-style check MEASURES against them, so
   * both halves must come from the same read — a prompt written to one set of
   * numbers and judged against another would produce objections nothing could
   * satisfy.
   *
   * ⚠️ Absent dependency means the built-in values, which is what every test
   * and the hand-written path use.
   */
  const tuning = deps.dials ? await deps.dials() : null;
  const tuned = tuning?.dials[args.platform];

  /**
   * 🔑 THE SHAPE IS DECIDED ONCE, HERE, beside the angle — and for the same
   * reason ⇒ contentMix.ts. Deciding it in three places (the prompt, the
   * picture, the stored media_kind) is how a post gets WRITTEN as a video and
   * SAVED as a graphic, which is the bug this ordering prevents.
   *
   * ⚠️ `shape` replaces `args.schedule.contentType` at every one of those
   * three sites. If any of them still reads the schedule directly, a mixed
   * schedule disagrees with itself.
   */


  const available = usablePools(args.schedule.topicPool, await deps.poolUsage(), undefined, args.platform);

  /**
   * ⛔ NARROWED BY WHAT THE OTHER CHANNELS ALREADY SAID TODAY, before the
   * weighting — so the weighting distributes over what is actually left
   * rather than over angles that are about to be dropped.
   */
  const spentToday =
    deps.poolsUsedOn && args.scheduledFor ? await deps.poolsUsedOn(args.scheduledFor) : [];
  const fresh = poolsLeftForToday(available, spentToday);

  const scores = angleScores(await deps.measuredPosts());
  const cycle = weightedCycle(fresh, turnsFor(fresh, scores, args.platform));
  const pool = nextPool(cycle, args.postsSoFar);

  /**
   * 🔑 THE ANGLE MAY OVERRIDE BOTH THE BRIEF AND THE SHAPE ⇒ topicPools.ts.
   *
   * ⛔ MEASURED, which is the only reason this exists. Given the live brief —
   * "take one capability of Imotara and say what it is for" — `ways-of-saying`
   * produced 3/3 product-shaped posts and NO list. Given a neutral brief it
   * produced 2/2 genuine five-item lists. The brief does not merely colour the
   * angle; it overrides its SHAPE.
   *
   * ⚠️ The shape override beats the content mix, because for that angle the
   * form IS the point: a list of five recognitions is a carousel or it is six
   * lines of small type.
   */
  const angle = TOPIC_POOLS.find((t) => t.id === pool);
  const brief = angle?.brief ?? args.schedule.brief;
  const shape = angle?.shape ?? shapeFor(args.schedule, args.postsSoFar);

  const word = pool === "untranslatable" ? pickWord(args.postsSoFar) : null;
  const mistake = pool === "built-wrong" ? pickMistake(args.postsSoFar) : null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const written = await deps.write({
      dials: tuned,
      // 🔑 The ANGLE's brief where it has one ⇒ topicPools.ts. Passing the
      // schedule's here regardless is what produced 3/3 product-shaped posts
      // from an angle that is not about the product.
      brief,
      tone: args.schedule.tone,
      lengthHint: args.schedule.lengthHint,
      language,
      platform: args.platform,
      /**
       * ⚠️ ONE pool, chosen here, not the whole list. ⇒ nextPool — the model
       * reliably picked the safest angle on the menu and the variety never
       * happened.
       */
      topicPool: [pool],
      // ⚠️ The SHAPE, so a carousel asks the model for cards rather than one
      // body ⇒ responseShape in writer.ts.
      contentType: shape,
      word: word ?? undefined,
      mistake: mistake ?? undefined,
      avoid: exclusionList(recent),
      previousObjections: objections.length ? [...objections] : undefined,
    });

    const subject = written.subject?.trim() ?? "";
    const body = written.body?.trim() ?? "";

    /**
     * 🔴 THE INSTRUCTION WAS NOT ENOUGH, AND IT WAS NEVER GOING TO BE.
     *
     * Handed অভিমান and told in capitals to use exactly it, the writer
     * produced a post about talking versus typing. The angle's own text still
     * carried a line from the previous design saying "if you are not sure,
     * choose a different post", and it took that exit — but the lesson is the
     * one this codebase already had: a prompt is an instruction, and anything
     * that must be true is checked afterwards ⇒ src/lib/social/writer.ts.
     *
     * ⛔ Rejected as a draft rather than published as an off-angle post: an
     * untranslatable post that is not about its word is not a worse version
     * of itself, it is a different post that nobody asked for — and it would
     * burn the rotation's turn.
     */
    /**
     * ⚠️ WEAKER THAN THE WORD CHECK, and said plainly rather than implied. A
     * word is either in the post or it is not. A mistake can be the right
     * subject with an invented detail bolted on, and no string match sees
     * that — which is why a post from this angle also never auto-publishes.
     */
    if (mistake && !mentionsMistake(`${subject}\n${body}`, mistake)) {
      const why =
        `This was written on the "what we got wrong" angle with a specific, confirmed mistake ` +
        `supplied, and the post is not about it. ⛔ Refused rather than queued: the only thing an ` +
        `admission is worth is that it is true.`;
      rejected.push({ attempt, subject, body, why });
      objections.push(why);
      continue;
    }

    if (word && !bodyUsesWord(`${subject}\n${body}`, word)) {
      const why =
        `This was written on the word angle with ${word.word} (${word.roman}) supplied, and the ` +
        `post does not use it. ⛔ The word is the post.`;
      rejected.push({ attempt, subject, body, why });
      objections.push(why);
      continue;
    }

    const verdict = judgeSubject(subject, recent);
    if (!verdict.ok) {
      const why = `Subject rejected: ${verdict.reason}${verdict.clashesWith ? ` — clashes with “${verdict.clashesWith}”` : ""}`;
      rejected.push({ attempt, subject, body, why });
      objections.push(why);
      continue;
    }

    /**
     * ⛔ THE GATE READS EVERY PUBLISHED WORD, which now includes the slides.
     *
     * The subject is published as the headline on the picture and often as
     * the first line of the caption. Each SLIDE is a card of its own — words
     * a reader sees, on a permanent public post. ⛔ A slide that never went
     * through the word check is a card nobody vetted, and it would be the
     * easiest place in this whole system for a claim to get out.
     */
    const slideText = (written.slides ?? []).join("\n");
    const gate = checkVoice(
      `${subject}\n${body}${slideText ? `\n${slideText}` : ""}`,
      language,
      overlay,
    );
    if (!gate.ok) {
      const why = `The gate rejected it: ${gate.findings.map((f) => `${f.matched} (${f.list})`).join(", ")}`;
      rejected.push({ attempt, subject, body, why, gate });
      objections.push(why);
      continue;
    }

    const houseStyle = checkHouseStyle(body, args.platform, tuned);
    const notes: string[] = [];
    /**
     * ⛔ A DROPPED ROW IS SAID OUT LOUD, on the post, where the reviewer is
     * already looking.
     *
     * 🔑 A tuning value that lapses quietly is indistinguishable from a bug:
     * the posts come out the wrong length and every check is green. The same
     * argument as a relaxed visual preference, which is reported rather than
     * silently honoured ⇒ aPictureNeverComesRoundTwice.
     */
    if (tuning?.notes.length) notes.push(...tuning.notes);
    let picture: Picture | null = null;
    let recipe: Recipe | null = null;

    if (wantsPicture(shape)) {
      const built = await buildPicture(deps, {
        language,
        // ⚠️ The subject is the card's headline ⇒ headlineFor. Omitting it
        // here is what made this decision disagree with the renderer.
        subject,
        body,
        scheduleId: args.schedule.id,
        platform: args.platform,
        // 🔑 The angle this was actually written from ⇒ nextPool, and the same
        // value stored on the row as `topic_pool`.
        topicPool: pool,
      });
      picture = built.picture;
      recipe = built.recipe;
      notes.push(...built.notes);
    }

    /**
     * 🔴 A CHANNEL THAT CANNOT POST WITHOUT A PICTURE RETRIES, THEN REFUSES.
     *
     * `buildPicture` returns no picture when the opening sentence is too long
     * to set as a headline — deliberately, because half a thought on a card
     * reads worse than no card, and on Facebook the words still go out.
     *
     * ⛔ On Instagram they cannot. But a hard refusal here was wrong too: the
     * FIRST Instagram draft failed exactly this way, and a channel that
     * refuses whenever a sentence runs long is a channel that never posts.
     * ⚠️ So it rejects the DRAFT, like every other objection in this loop, and
     * the model is told why on the next attempt. Only when every attempt has
     * failed the same way is it a refusal — and then it is a signal about the
     * brief, which is what the exhaustion message already says.
     *
     * 🔑 The real fix is upstream: a channel that requires a picture tells the
     * writer its headline limit before the first draft ⇒ writer.ts.
     */
    if (platformSpec(args.platform).requiresPicture && !picture) {
      const why =
        `${platformSpec(args.platform).label} has no text-only post and this draft made no card: ` +
        `${notes.join(" ") || "the opening sentence would not set as a headline."} ` +
        `▶️ The first sentence has to be short enough to BE the headline.`;
      rejected.push({ attempt, subject, body, why });
      objections.push(why);
      continue;
    }

    /**
     * 🔴 A CONFESSION NEVER POSTS UNATTENDED, whatever the schedule says.
     *
     * The keyword check above proves the post is about the right mistake. It
     * cannot prove the post did not ADD something — the right subject with an
     * invented detail attached looks exactly like a good post. A false claim
     * about our own company, published voluntarily, is the most expensive
     * thing this system could produce, so this angle keeps a human in the way
     * even when "post without asking me" is on.
     *
     * ⚠️ Overriding TOWARDS review only. ⛔ This may never turn a
     * needs_review into an approved.
     */
    const decided = decideStatus(args.schedule.autoPublish, language, overlay);
    const status = mistake ? "needs_review" : decided.status;
    const note =
      mistake && decided.status === "approved"
        ? `⚠️ Held for you to read. A post about something we got wrong never publishes ` +
          `unattended — the keyword check proves it is about the right mistake and cannot prove ` +
          `it did not add to it.`
        : decided.note;
    if (note) notes.push(note);
    if (gate.listsUnavailable.length > 0) {
      notes.push(
        `Not every list could be run on this post: ${gate.listsUnavailable.join(", ")} has no ` +
          `vocabulary for ${language}. ⛔ Reported rather than counted as a pass.`,
      );
    }
    if (!houseStyle.ok) notes.push(...houseStyle.problems);

    return {
      ok: true,
      post: {
        origin: "generated",
        scheduleId: args.schedule.id,
        authorId: null,
        platform: args.platform,
        language,
        subject,
        subjectHash: subjectHash(subject),
        body,
        support: written.support,
        status,
        mediaKind: mediaKindFor(shape, Boolean(picture)) as PreparedPost["mediaKind"],
        slides: written.slides,
        // 🔑 The angle this was actually written from ⇒ nextPool.
        topicPool: pool,
        picture,
        recipe,
        gate,
        houseStyle,
        notes,
        rejected,
      },
    };
  }

  return {
    ok: false,
    reason:
      `${maxAttempts} drafts were written and none passed. ⚠️ That is a signal about the brief, ` +
      `not bad luck — the objections are recorded against each attempt so the brief can be fixed. ` +
      `Nothing was published and nothing was queued.`,
    rejected,
  };
}

/**
 * Prepare a post a person wrote.
 *
 * ⛔ Identical checks. The only difference is that nobody asked a model for the
 * words — and the gate exists because people who knew the rules still wrote
 * eight claims that broke them, so this is the path it matters most on.
 */
export async function prepareWritten(
  deps: PipelineDeps,
  args: {
    authorId: string;
    platform: string;
    language: string;
    subject: string;
    body: string;
    support?: string;
    contentType: ContentType;
    /** A person pressing "post now" IS the human in the loop. */
    publishImmediately: boolean;
  },
): Promise<PrepareResult> {
  const language = assertPostableLanguage(args.language);
  const [recent, overlay] = await Promise.all([deps.recentSubjects(), deps.overlay()]);

  const subject = args.subject.trim();
  const body = args.body.trim();

  const verdict = judgeSubject(subject, recent);
  if (!verdict.ok) {
    return {
      ok: false,
      reason:
        `That subject has been used: ${verdict.reason}` +
        (verdict.clashesWith ? ` — it clashes with “${verdict.clashesWith}”.` : ".") +
        ` ⚠️ Change the subject, or post it under a different angle.`,
      rejected: [],
    };
  }

  const gate = checkVoice(`${subject}\n${body}`, language, overlay);
  if (!gate.ok) {
    return {
      ok: false,
      reason:
        `The gate objects to ${gate.findings.length === 1 ? "something" : `${gate.findings.length} things`} ` +
        `here: ${gate.findings.map((f) => `“${f.matched}” — ${f.because}`).join("; ")}.`,
      rejected: [{ attempt: 1, subject, body, why: "written by hand and rejected by the gate", gate }],
    };
  }

  /**
   * ⚠️ THE SAME DIALS THE GENERATED PATH USES. A hand-written post gets no
   * prompt, so there is nothing to tell — but the ADVICE must match, or an
   * admin is told its post is short against one set of numbers while the
   * writer is aiming at another.
   */
  const handTuning = deps.dials ? await deps.dials() : null;
  const houseStyle = checkHouseStyle(body, args.platform, handTuning?.dials[args.platform]);
  const notes: string[] = [];
  if (handTuning?.notes.length) notes.push(...handTuning.notes);
  let picture: Picture | null = null;
  let recipe: Recipe | null = null;

  if (wantsPicture(args.contentType)) {
    const built = await buildPicture(deps, {
      // ⚠️ A hand-written post's support line is not passed either. The admin
      // typed it, but checkVoice still did not read it, and the card has one
      // rule: it shows what the word check read. The line is kept on the post
      // for the record; it is not drawn.
      language,
      subject,
      body,
      scheduleId: null,
      platform: args.platform,
      // ⛔ A hand-written post has no pool, and stores none ⇒ store.ts. So it
      // gets no eyebrow, rather than a borrowed one.
      topicPool: null,
    });
    picture = built.picture;
    recipe = built.recipe;
    notes.push(...built.notes);
  }

  /**
   * 🔴 THE SAME RULE ON THE OTHER WAY IN.
   *
   * I put this guard on the generated path only, and a post written by hand
   * would still have been saved without a card. ⛔ The publisher would refuse
   * it, so nothing wrong publishes — but the loud refusal is the whole point,
   * and a rule that holds on one of two paths is a rule somebody will walk
   * around without knowing it ⇒ trap_crisis_card_two_detectors_two_platforms,
   * where a protection reached one platform and not the other.
   */
  if (platformSpec(args.platform).requiresPicture && !picture) {
    return {
      ok: false,
      rejected: [],
      reason:
        `${platformSpec(args.platform).label} has no text-only post, and no card could be made ` +
        `for this one: ${notes.join(" ") || "the opening sentence would not set as a headline."} ` +
        `▶️ Shorten the first sentence so it can be the headline.`,
    };
  }

  if (gate.listsUnavailable.length > 0) {
    notes.push(
      `Not every list could be run: ${gate.listsUnavailable.join(", ")} has no vocabulary for ` +
        `${language}. You are the check here.`,
    );
  }
  if (!houseStyle.ok) notes.push(...houseStyle.problems);

  return {
    ok: true,
    post: {
      origin: "written",
      scheduleId: null,
      authorId: args.authorId,
      platform: args.platform,
      language,
      subject,
      subjectHash: subjectHash(subject),
      body,
      support: args.support,
      // 🔑 A person writing and pressing post IS the review. The language tier
      // does not apply, because its whole purpose is to decide what may go out
      // with nobody reading it — and somebody just did.
      status: args.publishImmediately ? "approved" : "needs_review",
      mediaKind: mediaKindFor(args.contentType, Boolean(picture)) as PreparedPost["mediaKind"],
      picture,
      recipe,
      gate,
      houseStyle,
      notes,
      rejected: [],
    },
  };
}
