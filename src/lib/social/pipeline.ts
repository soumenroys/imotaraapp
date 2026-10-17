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
import {
  checkVoice,
  checkHouseStyle,
  canAutoPublishIn,
  type GateOverlay,
  type GateResult,
  type HouseStyleResult,
} from "@/lib/social/voiceGate";
import { judgeSubject, subjectHash, exclusionList } from "@/lib/social/subjects";
import { pickRecipe, headlineFromBody, type Recipe } from "@/lib/social/visualRecipe";
import { composePicture, type Picture } from "@/lib/social/compose";
import { platformSpec } from "@/lib/social/platforms";
import { allQrCodes, type QrCode } from "@/lib/social/brandMarks";

/**
 * ⚠️ `animated_gif` animates on X and nowhere else; `short_video` animates
 * everywhere. Both are offered because the owner asked for the GIF, and the
 * admin says which channels will actually move ⇒ animate.animationWarning.
 */
export type ContentType = "text" | "graphic" | "text_graphic" | "animated_gif" | "short_video";

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
  args: { language: string; body: string; support?: string; scheduleId: string | null; platform: string },
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
   * The QR, only where the channel earns one.
   *
   * ⛔ Not on X or Instagram: there the image is a thumbnail in a feed, on the
   * same phone that would have to scan it. A code there is decoration
   * pretending to be a function, and it costs space the words need.
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
    support: args.support,
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
  args: { schedule: ScheduleShape; platform: string; language: string },
): Promise<PrepareResult> {
  const language = assertPostableLanguage(args.language);
  const maxAttempts = deps.maxAttempts ?? 3;
  const [recent, overlay] = await Promise.all([deps.recentSubjects(), deps.overlay()]);
  const rejected: RejectedDraft[] = [];
  const objections: string[] = [];

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const written = await deps.write({
      brief: args.schedule.brief,
      tone: args.schedule.tone,
      lengthHint: args.schedule.lengthHint,
      language,
      platform: args.platform,
      topicPool: args.schedule.topicPool,
      avoid: exclusionList(recent),
      previousObjections: objections.length ? [...objections] : undefined,
    });

    const subject = written.subject?.trim() ?? "";
    const body = written.body?.trim() ?? "";

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
        support: written.support,
        scheduleId: args.schedule.id,
        platform: args.platform,
      });
      picture = built.picture;
      recipe = built.recipe;
      notes.push(...built.notes);
    }

    const { status, note } = decideStatus(args.schedule.autoPublish, language, overlay);
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
      language,
      body,
      support: args.support,
      scheduleId: null,
      platform: args.platform,
    });
    picture = built.picture;
    recipe = built.recipe;
    notes.push(...built.notes);
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
