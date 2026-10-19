/**
 * ⛔ A SCHEDULE THAT ONLY EVER MAKES ONE SHAPE MAKES A SAMEY FEED.
 *
 * 🔑 THE OWNER, 19 Oct: "randomly mix text+graphics and videos in content."
 * Measured at the time: the whole queue was `graphic`, 22 of 22, because
 * `content_type` is one value per schedule.
 *
 * ⛔ ROTATION, NOT `Math.random()`. A fair coin over two shapes gives four
 * videos in a row often enough to be noticed, and "why was it all videos this
 * week?" has no answer when the cause is a coin flip. The same reasoning that
 * made the ANGLE a rotation ⇒ trap_a_menu_handed_to_a_model_is_not_a_rotation.
 */

import { describe, it, expect } from "vitest";
import { shapeFor, mixProblems, kindOfShape } from "@/lib/social/contentMix";
import { CONTENT_TYPES, type ContentType } from "@/lib/social/contentTypes";

const sched = (mix?: string[] | null, contentType: ContentType = "text_graphic") =>
  ({ contentType, contentMix: mix ?? null });

describe("the rotation", () => {
  it("alternates, and comes round", () => {
    const s = sched(["text_graphic", "short_video"]);
    expect([0, 1, 2, 3, 4].map((n) => shapeFor(s, n))).toEqual([
      "text_graphic", "short_video", "text_graphic", "short_video", "text_graphic",
    ]);
  });

  it("🔑 weights by REPETITION, which is the whole reason it is an array", () => {
    // ⚠️ Two parts graphic to one part video is written exactly as it reads,
    // so the owner changes the balance by editing one row.
    const s = sched(["text_graphic", "text_graphic", "short_video"]);
    const got = [0, 1, 2, 3, 4, 5].map((n) => shapeFor(s, n));
    expect(got).toEqual([
      "text_graphic", "text_graphic", "short_video",
      "text_graphic", "text_graphic", "short_video",
    ]);
    expect(got.filter((x) => x === "short_video")).toHaveLength(2);
  });

  it("⛔ a null mix behaves EXACTLY as before — every schedule written until now", () => {
    /**
     * 🔴 THE REGRESSION THIS PINS. Adding a column must not change what
     * existing schedules produce. Both live schedules were `text_graphic`
     * with no mix the moment before this shipped.
     */
    for (const empty of [null, undefined, []]) {
      expect(shapeFor(sched(empty as string[] | null, "graphic"), 7)).toBe("graphic");
    }
  });

  it("⚠️ survives a nonsense counter rather than throwing", () => {
    // ⛔ An exception here stops the day's post. It has been wrong before.
    const s = sched(["text_graphic", "short_video"]);
    for (const n of [-1, Number.NaN, Infinity, 2.7]) {
      expect(CONTENT_TYPES as readonly string[]).toContain(shapeFor(s, n));
    }
  });

  it("⛔ skips an entry that is not a shape, rather than failing the post", () => {
    // 🔑 The database constraint should stop this; if a row gets past it —
    // a restore from before the constraint — the post is still written.
    expect(shapeFor(sched(["nonsense", "short_video"]), 0)).toBe("short_video");
    expect(shapeFor(sched(["nonsense"]), 0)).toBe("text_graphic");
  });
});

describe("a mix may not name a shape the channel cannot publish", () => {
  it("🔴 refuses a carousel on Facebook", () => {
    /**
     * ⛔ THE FAILURE THIS PREVENTS IS SILENT. Facebook takes multi-photo posts
     * by a route nothing has been built for, so such a post is saved,
     * approved, and then held by the publisher on every run forever. The only
     * symptom is a channel that posts every other day.
     */
    const problems = mixProblems(["text_graphic", "carousel"], ["facebook"]);
    expect(problems).toHaveLength(1);
    expect(problems[0].shape).toBe("carousel");
    expect(problems[0].why).toMatch(/held forever/i);
  });

  it("⛔ checks EVERY platform, not just the first", () => {
    // ⚠️ A schedule carrying both may only rotate through shapes both accept.
    const problems = mixProblems(["carousel"], ["instagram", "facebook"]);
    expect(problems.map((p) => p.platform)).toEqual(["facebook"]);
    expect(mixProblems(["carousel"], ["instagram"])).toEqual([]);
  });

  it("allows what the owner actually asked for, on both live channels", () => {
    expect(mixProblems(["text_graphic", "short_video"], ["instagram"])).toEqual([]);
    expect(mixProblems(["text_graphic", "short_video"], ["facebook"])).toEqual([]);
  });

  it("⛔ refuses a text-only post on Instagram, which has no such thing", () => {
    const problems = mixProblems(["text"], ["instagram"]);
    expect(problems).toHaveLength(1);
    expect(problems[0].why).toMatch(/cannot publish/i);
  });

  it("names an unknown shape and an unknown channel rather than passing them", () => {
    expect(mixProblems(["dance"], ["facebook"])[0].why).toMatch(/not a shape/i);
    expect(mixProblems(["graphic"], ["myspace"])[0].why).toMatch(/not a channel/i);
  });

  it("⚠️ an empty platform list cannot make a bad mix look fine", () => {
    // 🔑 A guard that passes when it has no information is worse than none.
    // The route reads the row rather than defaulting to [] ⇒ schedules/[id].
    expect(mixProblems(["carousel"], [])).toEqual([]);
  });
});

describe("the shape-to-kind map agrees with the pipeline's", () => {
  it("⛔ every shape maps to a kind, so a new one cannot be silently a graphic", () => {
    // 🔴 `mediaKindFor` in pipeline.ts is what actually writes the column.
    // This exists so the publishability CHECK can run BEFORE a post is
    // written; the two must not drift.
    expect(kindOfShape("text")).toBe("none");
    expect(kindOfShape("text_graphic")).toBe("graphic");
    expect(kindOfShape("graphic")).toBe("graphic");
    expect(kindOfShape("short_video")).toBe("short_video");
    expect(kindOfShape("animated_gif")).toBe("animated_gif");
    expect(kindOfShape("carousel")).toBe("carousel");
    for (const t of CONTENT_TYPES) expect(typeof kindOfShape(t)).toBe("string");
  });
});

/**
 * ⛔ AND THE PIPELINE ACTUALLY USES IT.
 *
 * 🔴 WRITTEN BECAUSE THE TESTS ABOVE PASSED WITHOUT IT. Replacing
 * `shapeFor(args.schedule, args.postsSoFar)` with `args.schedule.contentType`
 * in the pipeline — a mutation that ignores the mix entirely — left all
 * **3,826** tests green. Twelve of them proved the rotation works; none
 * proved anything calls it.
 *
 * ⚠️ THE THIRD TIME THIS EXACT SHAPE HAS APPEARED HERE: the support line that
 * no renderer passed, the dials that were read and not sent to the model, and
 * now this ⇒ trap_text_assertions_cannot_see_reachability.
 */
describe("⛔ and the pipeline actually rotates", () => {
  const CLEAN =
    "Most of the hard hours are not office hours. Imotara is awake then, in whichever of 22 " +
    "languages you think in. It is not therapy and does not pretend to be.";

  const draft = (subject: string) => ({ subject, body: CLEAN, support: "Private by default." });

  const deps = (drafts: ReturnType<typeof draft>[]) => {
    const queue = [...drafts];
    return {
      recentSubjects: async () => [],
      poolUsage: async () => ({}),
      measuredPosts: async () => [],
      usedRecipeHashes: async () => new Set<string>(),
      recentPalettes: async () => [],
      recentLayouts: async () => [],
      overlay: async () => ({}),
      write: async () => {
        const next = queue.shift();
        if (!next) throw new Error("the fake writer ran out of drafts");
        return next;
      },
      rng: () => 0.42,
    };
  };

  const schedule = (contentMix?: string[]) => ({
    id: "sched-1",
    name: "One thing it does",
    brief: "Take one capability and say what it is for, plainly.",
    platforms: ["facebook"],
    contentType: "text_graphic" as ContentType,
    contentMix: contentMix ?? null,
    topicPool: ["privacy"],
    tone: "gentle_plain",
    lengthHint: "short",
    languages: ["en"],
    autoPublish: false,
  });

  it("🔴 a mixed schedule produces DIFFERENT media kinds on consecutive posts", async () => {
    const { prepareGenerated } = await import("@/lib/social/pipeline");
    const kinds: string[] = [];

    for (const [n, subject] of ["What happens to what you type", "Where your words go", "On your device only"].entries()) {
      const r = await prepareGenerated(
        deps([draft(subject)]) as never,
        { schedule: schedule(["text_graphic", "short_video"]) as never, platform: "facebook", language: "en", postsSoFar: n },
      );
      expect(r.ok, `post ${n} was not written`).toBe(true);
      if (!r.ok) return;
      kinds.push(r.post.mediaKind);
    }

    // ⛔ The assertion the mutation would fail: not "a video exists somewhere"
    // but that the shape CHANGES with the counter.
    expect(kinds[0]).not.toBe(kinds[1]);
    expect(kinds[0]).toBe(kinds[2]);
    expect(kinds).toContain("short_video");
  });

  it("⛔ an unmixed schedule still produces one shape, every time", async () => {
    // 🔑 The regression half: a null mix must behave exactly as before.
    const { prepareGenerated } = await import("@/lib/social/pipeline");
    for (const n of [0, 1]) {
      const r = await prepareGenerated(
        deps([draft(`Subject number ${n}`)]) as never,
        { schedule: schedule() as never, platform: "facebook", language: "en", postsSoFar: n },
      );
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(r.post.mediaKind).toBe("graphic");
    }
  });
});
