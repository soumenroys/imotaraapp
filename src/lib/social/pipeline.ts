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
import { pickRecipe, headlineFromBody, supportFromBody, type Recipe } from "@/lib/social/visualRecipe";
import { pickWord, untranslatablePoolReady } from "@/lib/social/untranslatableWords";
import { pickMistake, mistakesPoolReady, mentionsMistake, type ProductMistake } from "@/lib/social/productMistakes";
import { composePicture, type Picture } from "@/lib/social/compose";
import { platformSpec } from "@/lib/social/platforms";
import { allQrCodes, type QrCode } from "@/lib/social/brandMarks";

// ⚠️ Re-exported, not declared. The list lives in contentTypes.ts so a client
// component can read it without pulling `crypto` through visualRecipe.
export { CONTENT_TYPES, type ContentType } from "@/lib/social/contentTypes";

export type ScheduleShape = {
  id: string;
  name: string;
  brief: string;
  platforms: string[];
  contentType: ContentType;
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
  /** Subjects the writer must not use again. ⚠️ A help, never the guarantee. */
  avoid: string[];
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

export type Written = { subject: string; body: string; support?: string };

export type PipelineDeps = {
  recentSubjects: () => Promise<string[]>;
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
  mediaKind: "none" | "graphic" | "animated_gif" | "short_video";
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

export function usablePools(pools: string[]): string[] {
  let out = pools;
  if (!untranslatablePoolReady().ok) out = out.filter((p) => p !== "untranslatable");
  // ⛔ Same rule, same reason: the first post this angle wrote invented a
  // history that never happened ⇒ src/lib/social/productMistakes.ts.
  if (!mistakesPoolReady().ok) out = out.filter((p) => p !== "built-wrong");
  return out;
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
    contentType === "short_video"
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
  return "graphic";
}

async function buildPicture(
  deps: PipelineDeps,
  args: { language: string; body: string; scheduleId: string | null; platform: string },
): Promise<{ picture: Picture | null; recipe: Recipe | null; notes: string[] }> {
  const notes: string[] = [];

  const headline = headlineFromBody(args.body);
  if (!headline) {
    // ⛔ Not a truncated headline. Half a sentence on a card is worse than no
    // card, and the post still works as text.
    notes.push(
      "No picture: the opening sentence is too long to set as a headline, and it is not truncated " +
        "here — half a thought on a card reads worse than no card. The post goes out as text.",
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
    if (qrCodes.length < 3) {
      notes.push(
        `Only ${qrCodes.length} of the three QR codes could be made. The picture is otherwise unchanged.`,
      );
    }
  }

  const picture = composePicture({
    recipe: picked.recipe,
    headline,
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
  args: { schedule: ScheduleShape; platform: string; language: string; postsSoFar: number },
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
  const pool = nextPool(usablePools(args.schedule.topicPool), args.postsSoFar);
  const word = pool === "untranslatable" ? pickWord(args.postsSoFar) : null;
  const mistake = pool === "built-wrong" ? pickMistake(args.postsSoFar) : null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const written = await deps.write({
      brief: args.schedule.brief,
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

    // ⛔ The gate reads the subject AND the body, because the subject is
    // published too — as the headline on the picture and often as the first
    // line of the caption.
    const gate = checkVoice(`${subject}\n${body}`, language, overlay);
    if (!gate.ok) {
      const why = `The gate rejected it: ${gate.findings.map((f) => `${f.matched} (${f.list})`).join(", ")}`;
      rejected.push({ attempt, subject, body, why, gate });
      objections.push(why);
      continue;
    }

    const houseStyle = checkHouseStyle(body, args.platform);
    const notes: string[] = [];
    let picture: Picture | null = null;
    let recipe: Recipe | null = null;

    if (wantsPicture(args.schedule.contentType)) {
      const built = await buildPicture(deps, {
        language,
        body,
        scheduleId: args.schedule.id,
        platform: args.platform,
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
        mediaKind: mediaKindFor(args.schedule.contentType, Boolean(picture)) as PreparedPost["mediaKind"],
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

  const houseStyle = checkHouseStyle(body, args.platform);
  const notes: string[] = [];
  let picture: Picture | null = null;
  let recipe: Recipe | null = null;

  if (wantsPicture(args.contentType)) {
    const built = await buildPicture(deps, {
      // ⚠️ A hand-written post's support line is not passed either. The admin
      // typed it, but checkVoice still did not read it, and the card has one
      // rule: it shows what the word check read. The line is kept on the post
      // for the record; it is not drawn.
      language,
      body,
      scheduleId: null,
      platform: args.platform,
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
