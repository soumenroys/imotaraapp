/**
 * ⛔ THE WHOLE RUN, END TO END, WITH A FAKE WRITER AND NO DATABASE.
 *
 * The other files test the pieces. This one tests the thing that actually
 * happens at 09:30: a schedule is due, a draft is written, the register and the
 * gate have their say, a picture is composed, and the post lands in a status.
 *
 * 🔑 WHY THIS IS THE FILE THAT MATTERS MOST. Every piece could be correct and
 * the FLOW still wrong — the gate called on the body but not the subject, the
 * retry reusing the rejected subject, auto-publish read from the schedule row
 * without re-checking the language, a picture composed from words that were
 * never gated. None of those is visible from a unit test of one function.
 *
 * ⚠️ The writer is a stub that returns whatever the test wants, INCLUDING bad
 * drafts. That is the point: the interesting paths are the ones where the model
 * produces something that must not be published.
 */

import { describe, it, expect } from "vitest";
import {
  prepareGenerated,
  prepareWritten,
  decideStatus,
  nextLanguage,
  wantsPicture,
  type PipelineDeps,
  type ScheduleShape,
  type Written,
} from "@/lib/social/pipeline";
import { wordsInPicture } from "@/lib/social/compose";
import { subjectHash } from "@/lib/social/subjects";
import {
  LAYOUTS,
  PALETTE_NAMES,
  TYPE_TREATMENTS,
  MOTIFS,
  WASHES,
  recipeHash,
} from "@/lib/social/visualRecipe";

const CLEAN_BODY =
  "Most of the hard hours are not office hours. Imotara is awake then, in whichever of 22 " +
  "languages you think in. It is not therapy and does not pretend to be.";

function deps(overrides: Partial<PipelineDeps> & { drafts?: Written[] } = {}): PipelineDeps {
  const queue = [...(overrides.drafts ?? [])];
  let call = 0;
  return {
    recentSubjects: async () => [],
    // ⚠️ Nothing spent yet, so every hand-fed angle is still available.
    poolUsage: async () => ({}),
    // ⚠️ Nothing measured, so the rotation is the plain round-robin.
    measuredPosts: async () => [],
    usedRecipeHashes: async () => new Set<string>(),
    recentPalettes: async () => [],
    recentLayouts: async () => [],
    overlay: async () => ({}),
    write: async () => {
      call++;
      const next = queue.shift();
      if (!next) throw new Error(`the fake writer ran out of drafts on call ${call}`);
      return next;
    },
    // Deterministic, so a failure is reproducible rather than occasional.
    rng: () => 0.42,
    ...overrides,
  };
}

const schedule = (over: Partial<ScheduleShape> = {}): ScheduleShape => ({
  id: "sched-1",
  name: "One thing it does",
  brief: "Take one capability and say what it is for, plainly.",
  platforms: ["facebook"],
  contentType: "text_graphic",
  topicPool: ["privacy"],
  tone: "gentle_plain",
  lengthHint: "short",
  languages: ["en"],
  autoPublish: false,
  ...over,
});

describe("the happy path", () => {
  it("writes, gates, composes and queues", async () => {
    const result = await prepareGenerated(
      deps({ drafts: [{ subject: "The hours nobody staffs", body: CLEAN_BODY, support: "22 languages." }] }),
      { schedule: schedule(), platform: "facebook", language: "en", postsSoFar: 0 },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const post = result.post;

    expect(post.origin).toBe("generated");
    expect(post.status).toBe("needs_review");
    expect(post.gate.ok).toBe(true);
    expect(post.gate.listsRun).toContain("clinical");
    expect(post.mediaKind).toBe("graphic");
    expect(post.picture).not.toBeNull();
    expect(post.rejected).toEqual([]);
    expect(post.subjectHash).toBe(subjectHash("The hours nobody staffs"));
    // ⚠️ The reviewer is told WHY it is waiting, not left to infer it.
    expect(post.notes.join(" ")).toMatch(/waiting for you/i);
  });

  it("every word in the picture came from the post", async () => {
    /**
     * ⛔ THE PROVENANCE ASSERTION, and the whole reason the composer never
     * writes copy. The gate reads text; it cannot read an image. So a picture
     * may only repeat words that have already been through it — and this is
     * what makes that checkable rather than merely intended.
     */
    const result = await prepareGenerated(
      deps({ drafts: [{ subject: "What happens to what you type", body: CLEAN_BODY, support: "Private by default." }] }),
      { schedule: schedule(), platform: "facebook", language: "en", postsSoFar: 0 },
    );
    expect(result.ok).toBe(true);
    if (!result.ok || !result.post.picture) return;

    const gated = `${result.post.subject}\n${result.post.body}\n${result.post.support ?? ""}`;
    /**
     * Fixed brand furniture — the only words on a picture that do not come
     * from the post.
     *
     * ⚠️ "Website", "Android" and "iPhone" are the QR labels, added 18 Oct.
     * This guard caught them the moment they appeared, which is the point: any
     * NEW text on a card has to be declared here deliberately, so nothing can
     * drift onto a picture without somebody deciding it should.
     */
    const allowed = ["22 languages", "imotara.com", "Imotara", "Website", "Android", "iPhone"];

    for (const text of wordsInPicture(result.post.picture)) {
      const fromPost = gated.includes(text);
      const furniture = allowed.includes(text);
      expect(
        fromPost || furniture,
        `the picture shows “${text}”, which is neither in the post nor fixed brand furniture`,
      ).toBe(true);
    }
  });
});

describe("when the gate objects", () => {
  it("throws the draft away and writes another", async () => {
    const result = await prepareGenerated(
      deps({
        drafts: [
          { subject: "Our expert counselors", body: "Talk to our expert counselors today." },
          { subject: "The hours nobody staffs", body: CLEAN_BODY },
        ],
      }),
      { schedule: schedule(), platform: "facebook", language: "en", postsSoFar: 0 },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // 🔑 The thrown-away draft is KEPT, so the owner can read what it tried.
    expect(result.post.rejected).toHaveLength(1);
    expect(result.post.rejected[0].why).toMatch(/gate/i);
    expect(result.post.rejected[0].body).toMatch(/counselors/);
    expect(result.post.subject).toBe("The hours nobody staffs");
  });

  it("gives up after three and reports it as a signal about the brief", async () => {
    const bad = { subject: "Our AI therapist", body: "Our AI therapist is here to heal you." };
    const result = await prepareGenerated(deps({ drafts: [bad, bad, bad] }), {
      schedule: schedule(),
      platform: "facebook",
      language: "en",
      postsSoFar: 0,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.rejected).toHaveLength(3);
    // ⚠️ Not "something went wrong": three refusals in a row is a fact about
    // the brief, and the message has to say so or nobody acts on it.
    expect(result.reason).toMatch(/brief/i);
    expect(result.reason).toMatch(/nothing was published/i);
  });

  it("reads the SUBJECT as well as the body", async () => {
    /**
     * 🔑 The subject is published too — as the headline on the picture and
     * often as the first line of the caption. A gate that read only the body
     * would let "Emotional healing in 22 languages" through as a headline.
     */
    // ⚠️ Three copies, because the run retries: one draft would make the fake
    // writer throw on attempt two and the test would fail for the wrong reason.
    const bad = { subject: "Emotional healing, in 22 languages", body: CLEAN_BODY };
    const result = await prepareGenerated(deps({ drafts: [bad, bad, bad] }), {
      schedule: schedule(),
      platform: "facebook",
      language: "en",
      postsSoFar: 0,
    });
    expect(result.ok, "a clinical claim in the SUBJECT was let through").toBe(false);
    if (result.ok) return;
    expect(result.rejected[0].why).toMatch(/healing/i);
  });

  it("tells the writer what was wrong, so the retry is not a coin flip", async () => {
    const objections: string[][] = [];
    const result = await prepareGenerated(
      deps({
        drafts: [
          { subject: "Our expert counselors", body: "Our expert counselors are here." },
          { subject: "The hours nobody staffs", body: CLEAN_BODY },
        ],
        write: async (req) => {
          objections.push(req.previousObjections ?? []);
          return req.previousObjections?.length
            ? { subject: "The hours nobody staffs", body: CLEAN_BODY }
            : { subject: "Our expert counselors", body: "Our expert counselors are here." };
        },
      }),
      { schedule: schedule(), platform: "facebook", language: "en", postsSoFar: 0 },
    );
    expect(result.ok).toBe(true);
    expect(objections[0]).toEqual([]);
    expect(objections[1]?.join(" ")).toMatch(/gate/i);
  });
});

describe("when the subject has been used", () => {
  it("rejects it and tries again", async () => {
    const result = await prepareGenerated(
      deps({
        recentSubjects: async () => ["The people who think in Odia"],
        drafts: [
          { subject: "Odia, and the people who think in it", body: CLEAN_BODY },
          { subject: "The hours nobody staffs", body: CLEAN_BODY },
        ],
      }),
      { schedule: schedule(), platform: "facebook", language: "en", postsSoFar: 0 },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.post.rejected[0].why).toMatch(/subject/i);
    expect(result.post.rejected[0].why).toMatch(/clashes/i);
  });

  it("hands the writer the exclusion list", async () => {
    let seen: string[] = [];
    await prepareGenerated(
      deps({
        recentSubjects: async () => ["One", "Two", "Three"],
        write: async (req) => {
          seen = req.avoid;
          return { subject: "The hours nobody staffs", body: CLEAN_BODY };
        },
      }),
      { schedule: schedule(), platform: "facebook", language: "en", postsSoFar: 0 },
    );
    expect(seen).toEqual(["One", "Two", "Three"]);
  });
});

describe("the auto-publish setting", () => {
  it("off means it waits", () => {
    expect(decideStatus(false, "en", {}).status).toBe("needs_review");
  });

  it("on means it posts, in a language that qualifies", () => {
    expect(decideStatus(true, "en", {}).status).toBe("approved");
  });

  it("⛔ on is OVERRIDDEN for a language that does not qualify", () => {
    /**
     * 🔴 THE MOST IMPORTANT ASSERTION IN THIS FILE. The database trigger
     * refuses to STORE auto-publish with an unqualified language; this refuses
     * to ACT on it. Two independent checks of one rule, because the row could
     * have been written before a language was demoted, or by a path that
     * predates the trigger.
     */
    const verdict = decideStatus(true, "bn", {});
    expect(verdict.status).toBe("needs_review");
    expect(verdict.note).toMatch(/held anyway/i);
    expect(verdict.note).toMatch(/abuse|profanity/i);
  });

  it("a contributed list plus a reader does let it through", () => {
    const verdict = decideStatus(true, "bn", { abuse: { bn: ["বাজে", "baje"] } });
    expect(verdict.status).toBe("approved");
  });

  it("carries through the whole run, not just the helper", async () => {
    const result = await prepareGenerated(
      deps({ drafts: [{ subject: "The hours nobody staffs", body: CLEAN_BODY }] }),
      { schedule: schedule({ autoPublish: true, languages: ["bn"] }), platform: "facebook", language: "bn", postsSoFar: 0 },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.post.status).toBe("needs_review");
    // And it says that a list could not be run, rather than counting it a pass.
    expect(result.post.notes.join(" ")).toMatch(/not every list could be run/i);
  });
});

describe("the language rotation", () => {
  it("cycles rather than choosing at random", () => {
    const langs = ["en", "bn", "hi"];
    expect([0, 1, 2, 3, 4, 5].map((n) => nextLanguage(langs, n))).toEqual([
      "en", "bn", "hi", "en", "bn", "hi",
    ]);
  });

  it("refuses an empty list rather than defaulting to English", () => {
    expect(() => nextLanguage([], 0)).toThrow(/no default/i);
  });

  it("refuses a nonsense count rather than wrapping oddly", () => {
    expect(() => nextLanguage(["en"], -1)).toThrow();
    expect(() => nextLanguage(["en"], Number.NaN)).toThrow();
  });
});

describe("the picture", () => {
  const LONG_BODY =
    "This opening sentence has been written deliberately long so that no headline could hold it " +
    "without cutting it in half somewhere awkward. And then a second sentence.";

  it("uses the SUBJECT as the headline when the opening sentence is too long", async () => {
    /**
     * 🔴 THE SUBJECT IS WRITTEN TO BE THE HEADLINE, and this decision used to
     * ignore it. `buildPicture` asked `headlineFromBody(body)` while the
     * renderer asked `headlineFor(subject, body)` — so one piece of code
     * decided whether a card could exist and another decided what it would
     * say, from different inputs.
     *
     * ⛔ The cost: a post with a perfectly good short subject was refused a
     * card, which on a channel with no text-only post means refused entirely.
     * Three Instagram drafts died that way.
     */
    const result = await prepareGenerated(
      deps({ drafts: [{ subject: "A long opening", body: LONG_BODY }] }),
      { schedule: schedule(), platform: "facebook", language: "en", postsSoFar: 0 },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.post.picture).not.toBeNull();
    expect(result.post.mediaKind).toBe("graphic");
  });

  it("is skipped, not truncated, when NEITHER will serve as a headline", async () => {
    // ⚠️ The rule that has not moved: nothing is ever cut in half. A subject
    // too long to be a headline falls through to the body, and a body too
    // long means no card at all.
    const longSubject =
      "A subject so long that it could not possibly be set as a headline on a card without being cut";
    const result = await prepareGenerated(
      deps({ drafts: [{ subject: longSubject, body: LONG_BODY }] }),
      { schedule: schedule(), platform: "facebook", language: "en", postsSoFar: 0 },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.post.picture).toBeNull();
    expect(result.post.mediaKind).toBe("none");
    expect(result.post.notes.join(" ")).toMatch(/no picture/i);
  });

  it("is not composed at all for a text-only schedule", async () => {
    const result = await prepareGenerated(
      deps({ drafts: [{ subject: "The hours nobody staffs", body: CLEAN_BODY }] }),
      { schedule: schedule({ contentType: "text" }), platform: "facebook", language: "en", postsSoFar: 0 },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.post.picture).toBeNull();
    expect(wantsPicture("text")).toBe(false);
  });

  it("says when the wordmark had to fall back to Latin", async () => {
    /**
     * ⚠️ TAMIL, NOT BENGALI — the example moved on 19 Oct when the owner
     * confirmed a Bengali card rendered in production. The RULE is unchanged:
     * a post in an unverified script gets a Latin wordmark, and the reviewer
     * is TOLD rather than left to notice.
     */
    const result = await prepareGenerated(
      deps({ drafts: [{ subject: "The hours nobody staffs", body: CLEAN_BODY }] }),
      { schedule: schedule({ languages: ["ta"] }), platform: "facebook", language: "ta", postsSoFar: 0 },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.post.picture?.wordmark.substituted).toBe(true);
    expect(result.post.notes.join(" ")).toMatch(/latin/i);
  });

  it("reports a relaxed recency preference instead of swallowing it", async () => {
    const result = await prepareGenerated(
      deps({
        drafts: [{ subject: "The hours nobody staffs", body: CLEAN_BODY }],
        /**
         * ⚠️ MY FIRST VERSION OF THIS SETUP DID NOT WORK, and the way it failed
         * is worth keeping. I listed every palette and layout as "recent",
         * assuming that would leave nothing allowed — but the window only
         * takes the first five, so `forest` and three layouts were still free
         * and no relaxation happened.
         *
         * ⇒ To force it, every recipe must be USED except ones the preference
         * forbids. That is the only state in which the guarantee and the
         * preference genuinely conflict.
         */
        usedRecipeHashes: async () => {
          const used = new Set<string>();
          for (const layout of LAYOUTS)
            for (const palette of PALETTE_NAMES)
              for (const typeTreatment of TYPE_TREATMENTS)
                for (const motif of MOTIFS)
                  /**
                   * ⚠️ AND THE WASH AXIS, added 19 Oct. Exactly the same way
                   * this setup failed the first time: an axis left out of the
                   * enumeration leaves recipes unused, so nothing is forced
                   * and no relaxation happens. ⛔ A test that exhausts a space
                   * has to exhaust ALL of it.
                   */
                  for (const wash of WASHES)
                    if (!(layout === "stacked-label" && palette === "ink"))
                      used.add(recipeHash({ layout, palette, typeTreatment, motif, wash, script: "en" }));
          return used;
        },
        recentPalettes: async () => ["ink"],
        recentLayouts: async () => ["stacked-label"],
      }),
      { schedule: schedule(), platform: "facebook", language: "en", postsSoFar: 0 },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.post.notes.join(" ")).toMatch(/preference was dropped/i);
    expect(result.post.picture).not.toBeNull();
  });
});

describe("a post written by a person", () => {
  it("goes through the identical gate", async () => {
    const result = await prepareWritten(deps(), {
      authorId: "admin-1",
      platform: "facebook",
      language: "en",
      subject: "Our expert counselors",
      body: "Talk to our expert counselors today.",
      contentType: "text",
      publishImmediately: true,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    // ⛔ And the refusal explains itself: the gate exists to protect us from
    // ourselves, so it has to be legible to the person it just refused.
    expect(result.reason).toMatch(/counselors/);
    expect(result.reason).toMatch(/regulated title/i);
  });

  it("is approved immediately when a person says post it", async () => {
    const result = await prepareWritten(deps(), {
      authorId: "admin-1",
      platform: "linkedin",
      language: "en",
      subject: "The hours nobody staffs",
      body: CLEAN_BODY,
      contentType: "text",
      publishImmediately: true,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.post.status).toBe("approved");
    expect(result.post.origin).toBe("written");
    expect(result.post.authorId).toBe("admin-1");
    expect(result.post.scheduleId).toBeNull();
  });

  it("may be written in a language no schedule could post in unattended", async () => {
    /**
     * 🔑 THE CONSEQUENCE WORTH PINNING. The language tier decides what may go
     * out with NOBODY READING IT. A person writing and approving is somebody
     * reading it, so all 22 are open here — otherwise the tier would be
     * banning a human from using their own language, which it was never for.
     */
    const result = await prepareWritten(deps(), {
      authorId: "admin-1",
      platform: "facebook",
      language: "or",
      subject: "Odia, and the people who think in it",
      body: CLEAN_BODY,
      contentType: "text",
      publishImmediately: true,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.post.status).toBe("approved");
    // And it still says which checks could not run.
    expect(result.post.notes.join(" ")).toMatch(/you are the check here/i);
  });

  it("refuses a subject the register already holds", async () => {
    const result = await prepareWritten(deps({ recentSubjects: async () => ["The hours nobody staffs"] }), {
      authorId: "admin-1",
      platform: "facebook",
      language: "en",
      subject: "The hours nobody staffs",
      body: CLEAN_BODY,
      contentType: "text",
      publishImmediately: false,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toMatch(/has been used/i);
  });

  it("queues rather than approving when the person does not say post it", async () => {
    const result = await prepareWritten(deps(), {
      authorId: "admin-1",
      platform: "facebook",
      language: "en",
      subject: "The hours nobody staffs",
      body: CLEAN_BODY,
      contentType: "text",
      publishImmediately: false,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.post.status).toBe("needs_review");
  });
});

describe("what the run never does", () => {
  it("never returns a post with findings against it", async () => {
    // 🔑 A whole-set invariant rather than a case: whatever path a prepared
    // post took, it cannot carry an unresolved gate finding. If it could, the
    // queue would contain something that was never meant to be approvable.
    const drafts: Written[] = [
      { subject: "A clean one", body: CLEAN_BODY },
      { subject: "Our therapist", body: "Our therapist heals you." },
      { subject: "Crazy good replies", body: "The replies are crazy good." },
    ];
    for (const d of drafts) {
      const result = await prepareGenerated(deps({ drafts: [d, d, d] }), {
        schedule: schedule(),
        platform: "facebook",
        language: "en",
      postsSoFar: 0,
      });
      if (result.ok) expect(result.post.gate.findings).toEqual([]);
    }
  });

  it("never invents a language", async () => {
    await expect(
      prepareGenerated(deps({ drafts: [{ subject: "x", body: CLEAN_BODY }] }), {
        schedule: schedule(),
        platform: "facebook",
        language: "ko",
      postsSoFar: 0,
      }),
    ).rejects.toThrow(/22 languages/);
  });
});

describe("⛔ the card shows only what the word check read", () => {
  /**
   * 🔴 THE HOLE: the writer is asked for a separate `support` line, and
   * checkVoice never reads it — the gate runs on `subject\nbody`. buildPicture
   * composed the card with that line, so an unchecked sentence could be set in
   * type on a published picture while every gate chip on the review screen
   * showed a tick.
   *
   * ⚠️ It was also never stored, so the serving route re-rendered from the body
   * alone: the recipe was chosen against one set of words and the picture a
   * reader saw carried another.
   *
   * ⇒ The support on a card is derived from the body, which is the text the
   * gate read. These two tests are the reason that is not merely tidier.
   */
  it("does not set the writer's ungated support line in the picture", async () => {
    const poisoned: Written = {
      subject: "What stays on your device",
      body: CLEAN_BODY,
      // ⛔ Would be thrown out instantly if the gate ever saw it. It does not.
      support: "Our therapist will see you now.",
    };
    const out = await prepareGenerated(deps({ drafts: [poisoned] }), {
      schedule: schedule({ contentType: "text_graphic" }),
      platform: "facebook",
      language: "en",
      postsSoFar: 0,
    });

    expect(out.ok).toBe(true);
    const post = (out as Extract<typeof out, { ok: true }>).post;
    expect(post.picture, "no picture was composed, so this proves nothing").toBeTruthy();
    const words = wordsInPicture(post.picture as never).join(" ");
    expect(words, "an ungated sentence reached the card").not.toContain("therapist");
    expect(words).not.toContain("Our therapist will see you now.");
  });

  it("sets the body's own second sentence instead", async () => {
    const draft: Written = { subject: "What stays on your device", body: CLEAN_BODY, support: "ignored" };
    const out = await prepareGenerated(deps({ drafts: [draft] }), {
      schedule: schedule({ contentType: "text_graphic" }),
      platform: "facebook",
      language: "en",
      postsSoFar: 0,
    });
    const post = (out as Extract<typeof out, { ok: true }>).post;
    const words = wordsInPicture(post.picture as never);
    // 🔑 The second sentence of CLEAN_BODY, verbatim — not a truncation, and
    // not the first sentence repeated under itself.
    expect(words).toContain(
      "Imotara is awake then, in whichever of 22 languages you think in. It is not therapy and does not pretend to be.",
    );
  });
});
