/**
 * ⛔ THE TWO PIECES BETWEEN THE CLOCK AND THE WORDS.
 *
 * Neither is interesting until it is wrong, and both are wrong in ways that
 * take weeks to notice:
 *
 *   • `isDue` reads a wall clock in the schedule's own zone. "09:30
 *     Asia/Kolkata on weekdays" compared against a UTC clock works for eleven
 *     months and then posts on the wrong day when a date boundary falls between
 *     the two — IST is +05:30, so a 09:30 slot is 04:00 UTC and nothing about
 *     that is obvious from reading the code.
 *
 *   • `parseWritten` reads a model's reply. Models fence JSON in markdown
 *     roughly half the time however firmly they are asked not to, so a parser
 *     that only accepts bare JSON fails half the runs for a reason that has
 *     nothing to do with the content.
 */

import { describe, it, expect } from "vitest";
import { slotsInHorizon } from "@/lib/social/horizon";
import { parseWritten, buildPrompt } from "@/lib/social/writer";
import { composePicture, wordsInPicture, imagesInPicture } from "@/lib/social/compose";
import { PLATFORMS, PLATFORM_IDS } from "@/lib/social/platforms";
import { LAYOUTS, PALETTE_NAMES, TYPE_TREATMENTS, MOTIFS, recipeHash } from "@/lib/social/visualRecipe";

const weekdaysAt = (postAt: string, timezone = "Asia/Kolkata") => ({
  post_at: postAt,
  timezone,
  days: [1, 2, 3, 4, 5],
  active: true,
});

/**
 * 🔴 THIS BLOCK TESTED A MODEL THAT NO LONGER RUNS, and that is why it has
 * been replaced rather than deleted.
 *
 * It proved things about `isDue` — "fires two hours before the slot", "does
 * not fire a minute early or late", "fires exactly once a day". Every one was
 * true, and on 19 Oct every one stopped mattering: the lead time was replaced
 * by a ten-day horizon ⇒ src/lib/social/horizon.ts. Nothing in production
 * calls `isDue` any more, so these tests passed while guarding nothing, and
 * the suite looked healthy.
 *
 * ⚠️ THE RULES THEMSELVES SURVIVED, in a different shape — a slot's instant
 * must be computed in the SCHEDULE'S zone and on the schedule's weekday, or a
 * date boundary between the two puts a post out at the wrong hour. Those are
 * pinned against the live code in tenDaysOfReviewTime.test.ts (zones, DST,
 * day-walking) and eachChannelKeepsItsOwnHour.test.ts (per-channel times).
 *
 * ⛔ What CANNOT come back is "fires once a day on an exact minute" — the
 * horizon has no firing minute at all, which is the point of it: a missed
 * minute used to be a missed day forever.
 */
describe("the schedule's own zone decides the hour", () => {
  it("a slot is the schedule's wall clock, in the schedule's zone", () => {
    // 09:30 IST on 20 Oct is 04:00 UTC — the same arithmetic the old `isDue`
    // did, now done once when the slot is created rather than every minute.
    const slots = slotsInHorizon(
      {
        id: "s",
        post_at: "09:30",
        timezone: "Asia/Kolkata",
        days: [1, 2, 3, 4, 5],
        active: true,
        platforms: ["facebook"],
        platform_times: null,
      },
      new Date("2026-10-19T05:08:00Z"),
    );
    expect(slots[0].scheduledFor).toBe("2026-10-20T04:00:00.000Z");
  });

  it("⛔ and never lands on a day the schedule did not ask for", () => {
    const slots = slotsInHorizon(
      {
        id: "s",
        post_at: "09:30",
        timezone: "Asia/Kolkata",
        days: [1, 2, 3, 4, 5],
        active: true,
        platforms: ["facebook"],
        platform_times: null,
      },
      new Date("2026-10-19T05:08:00Z"),
    );
    const weekdays = slots.map((x) =>
      new Date(x.scheduledFor).toLocaleDateString("en-GB", { timeZone: "Asia/Kolkata", weekday: "short" }),
    );
    expect(weekdays).not.toContain("Sat");
    expect(weekdays).not.toContain("Sun");
  });
});

describe("the model's reply", () => {
  it("reads bare JSON", () => {
    const w = parseWritten('{"subject":"A thing","body":"Some words.","support":"A line."}');
    expect(w).toEqual({ subject: "A thing", body: "Some words.", support: "A line." });
  });

  it("reads JSON inside a markdown fence", () => {
    const w = parseWritten('```json\n{"subject":"A thing","body":"Some words."}\n```');
    expect(w.subject).toBe("A thing");
  });

  it("reads JSON with commentary around it", () => {
    const w = parseWritten('Sure! Here you go:\n{"subject":"A thing","body":"Some words."}\nHope that helps.');
    expect(w.subject).toBe("A thing");
  });

  it("drops an empty support line rather than carrying an empty string", () => {
    expect(parseWritten('{"subject":"A thing","body":"Words.","support":""}').support).toBeUndefined();
  });

  it("⛔ throws rather than filling in a missing subject", () => {
    // A default would poison the register: every such post would collide, or
    // worse, claim a subject nobody chose.
    expect(() => parseWritten('{"body":"Some words."}')).toThrow(/subject/i);
    expect(() => parseWritten('{"subject":"A thing"}')).toThrow(/body/i);
  });

  it("throws on something that is not JSON at all", () => {
    expect(() => parseWritten("I cannot help with that.")).toThrow(/JSON/i);
    expect(() => parseWritten("")).toThrow();
  });

  it("keeps non-Latin text intact", () => {
    const w = parseWritten('{"subject":"ভাষা","body":"ইমোতারা এখানে আছে।"}');
    expect(w.subject).toBe("ভাষা");
    expect(w.body).toBe("ইমোতারা এখানে আছে।");
  });
});

describe("the prompt", () => {
  const req = {
    brief: "Say one true thing about privacy.",
    tone: "gentle_plain",
    lengthHint: "short",
    language: "bn",
    topicPool: ["privacy"],
    avoid: ["An old subject"],
  };

  it("names the language it wants, in words", () => {
    const p = buildPrompt(req);
    expect(p).toContain("Bengali");
    // ⚠️ And asks for a native voice rather than a translation — the one thing
    // a reviewer in that language will actually judge.
    expect(p).toMatch(/not as somebody translating/i);
  });

  it("carries the forbidden vocabulary and the exclusion list", () => {
    const p = buildPrompt(req);
    expect(p).toMatch(/therapist/);
    expect(p).toMatch(/crazy/);
    expect(p).toMatch(/An old subject/);
  });

  it("states no fact the product cannot back", () => {
    // ⛔ Structural: the prompt is where an invented statistic would enter, and
    // it would then be in a published post with nothing behind it.
    const p = buildPrompt(req);
    expect(p).toMatch(/Do not invent a statistic/i);
    expect(p).toMatch(/22 languages/);
  });

  it("does not promise the model that uniqueness is its job", () => {
    /**
     * 🔑 The prompt asks it not to repeat itself, and the register is what
     * makes that true. This pins the ORDER of trust: if somebody ever deletes
     * the register check believing the instruction is enough, the flow tests
     * fail — not this one. This only pins that the instruction is present.
     */
    expect(buildPrompt(req)).toMatch(/do not write about any of these again/i);
  });
});

describe("the composer", () => {
  const recipe = (over: Record<string, string> = {}) => {
    const base = { layout: "rule-over", palette: "ink", typeTreatment: "display", motif: "arcs", script: "en", ...over };
    return { ...base, hash: recipeHash(base as never) } as never;
  };

  it("composes every layout, palette, treatment and motif without throwing", () => {
    // 🔑 1,152 combinations per language, all exercised. A layout that threw —
    // or quietly dropped the headline — would otherwise only be found on the
    // day the picker happened to choose it.
    let composed = 0;
    for (const layout of LAYOUTS)
      for (const palette of PALETTE_NAMES)
        for (const typeTreatment of TYPE_TREATMENTS)
          for (const motif of MOTIFS) {
            const picture = composePicture({
              recipe: recipe({ layout, palette, typeTreatment, motif }),
              headline: "Most of the hard hours are not office hours",
              platform: "facebook",
              language: "en",
            });
            expect(picture.width).toBe(PLATFORMS.facebook.picture.width);
            expect(wordsInPicture(picture)).toContain("Most of the hard hours are not office hours");
            composed++;
          }
    expect(composed).toBe(LAYOUTS.length * PALETTE_NAMES.length * TYPE_TREATMENTS.length * MOTIFS.length);
  });

  it("uses only flex, never grid", () => {
    // ⚠️ Satori does not support `display: grid`, and it fails by stacking
    // everything at the top left rather than by throwing — the kind of failure
    // that ships.
    const picture = composePicture({
      recipe: recipe(),
      headline: "A headline",
      platform: "facebook",
      support: "A supporting line",
      language: "en",
    });
    const styles: string[] = [];
    const walk = (n: { style: Record<string, string | number>; children?: unknown[] }) => {
      styles.push(String(n.style.display ?? ""));
      (n.children as typeof styles | undefined)?.forEach?.((c) => walk(c as never));
    };
    walk(picture.root as never);
    expect(styles.filter((d) => d && d !== "flex")).toEqual([]);
  });

  it("refuses to compose without a headline rather than inventing one", () => {
    expect(() => composePicture({ recipe: recipe(), headline: "   ", language: "en", platform: "facebook" })).toThrow(
      /never writes one/i,
    );
  });

  it("refuses an unknown palette or layout rather than guessing", () => {
    expect(() => composePicture({ recipe: recipe({ palette: "chartreuse" }), headline: "A", language: "en", platform: "facebook" })).toThrow(
      /unknown palette/i,
    );
    expect(() => composePicture({ recipe: recipe({ layout: "diagonal" }), headline: "A", language: "en", platform: "facebook" })).toThrow(
      /unknown layout/i,
    );
  });

  it("sets the Latin wordmark, and says so, for a script nobody has verified", () => {
    /**
     * ⚠️ TAMIL, NOT BENGALI. This used Bengali until 19 Oct, when the owner
     * confirmed a Bengali card rendered in production and the flag flipped.
     * ⛔ The RULE is unchanged and is what matters: an unverified script gets
     * the Latin wordmark and the reviewer is told why. Only the example had
     * to move to a script that is still unverified.
     */
    const picture = composePicture({ recipe: recipe({ script: "ta" }), headline: "A headline", language: "ta", platform: "facebook" });
    expect(picture.wordmark.substituted).toBe(true);
    expect(wordsInPicture(picture)).toContain("Imotara");
    expect(picture.notes.join(" ")).toMatch(/nobody here can tell/i);
  });

  it("⛔ and a CONFIRMED script keeps its own wordmark", () => {
    // 🔑 The other half of the same switch: confirming Bengali unlocked the
    // wordmark AND the card's words together, which is the whole point of
    // asking one question once ⇒ fonts.ts.
    const picture = composePicture({ recipe: recipe({ script: "bn" }), headline: "A headline", language: "bn", platform: "facebook" });
    expect(picture.wordmark.substituted).toBe(false);
    expect(wordsInPicture(picture)).not.toContain("Imotara");
  });

  it("⛔ uses no CSS shorthand Satori ignores", () => {
    /**
     * 🔴 BOTH OF THESE WERE REAL, AND BOTH WERE FOUND BY RENDERING A PNG AND
     * LOOKING AT IT — never by a test, and no test of the tree could have:
     * every assertion about the structure was satisfied while the picture came
     * out wrong.
     *
     *   • `inset: 0` on the motif layer gave it no height. The dotted grid
     *     rendered as one row of dots along the top edge and the bands did not
     *     appear at all, so two of the six motifs were silently decorative.
     *
     * ⚠️ Satori does not warn about a property it does not understand. It
     * ignores it. ⇒ Anything load-bearing has to be written longhand, and this
     * is the list of shorthands that have actually bitten.
     */
    const FORBIDDEN = ["inset", "place-items", "place-content", "grid-area", "aspect-ratio"];
    for (const layout of LAYOUTS)
      for (const motif of MOTIFS) {
        const picture = composePicture({
          recipe: recipe({ layout, motif }),
          headline: "A headline",
          platform: "facebook",
          support: "A supporting line",
          language: "en",
        });
        const seen: string[] = [];
        const walk = (n: { style: Record<string, unknown>; children?: unknown[] }) => {
          seen.push(...Object.keys(n.style));
          (n.children as unknown[] | undefined)?.forEach((c) => walk(c as never));
        };
        walk(picture.root as never);
        for (const bad of FORBIDDEN) {
          expect(seen, `${layout}/${motif} uses "${bad}", which Satori ignores silently`).not.toContain(bad);
        }
      }
  });

  it("⛔ puts the brand sign-off last in every layout", () => {
    /**
     * 🔴 THE OTHER RENDERING DEFECT. `language-grid` ordered the footer BEFORE
     * the supporting line, so the wordmark appeared above a sentence that was
     * still part of the post. Obvious in a picture, invisible in a tree — so
     * the invariant is stated here rather than left to the next person's eye.
     */
    for (const layout of LAYOUTS) {
      const picture = composePicture({
        recipe: recipe({ layout }),
        headline: "A headline",
        platform: "facebook",
        support: "A supporting line",
        language: "en",
      });
      const words = wordsInPicture(picture);
      const wordmarkAt = words.indexOf("Imotara");
      const supportAt = words.indexOf("A supporting line");
      expect(wordmarkAt, `${layout} has no wordmark`).toBeGreaterThanOrEqual(0);
      expect(
        wordmarkAt,
        `${layout} puts the brand sign-off above a line that is still part of the post`,
      ).toBeGreaterThan(supportAt);
    }
  });

  it("names a font on the root, because Satori draws nothing without one", () => {
    const picture = composePicture({ recipe: recipe(), headline: "A headline", language: "en", platform: "facebook" });
    expect(String(picture.root.style.fontFamily ?? "")).toBeTruthy();
  });
});
