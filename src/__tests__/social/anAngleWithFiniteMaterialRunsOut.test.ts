/**
 * 🔴 FOUR POSTS ABOUT ONE WORD, IN ONE TEN-DAY QUEUE.
 *
 * The ten-day horizon filled for the first time on 19 Oct and produced:
 *
 *     21 Oct  instagram  "Abhimaan: the hurt that waits to be noticed"
 *     24 Oct  facebook   "Abhimaan: when pride feels tender"
 *     26 Oct  facebook   "Abhimaan: the quiet sulk that waits to be met"
 *     28 Oct  instagram  "Abhimaan: the sulk that asks to be seen"
 *
 * ⚠️ Four DIFFERENT subjects, so the overlap check passed every time — and
 * the same post four times, which is what a reader actually sees.
 *
 * 🔑 THE CAUSE IS STRUCTURAL, not a bad draft. `untranslatable` may not
 * choose its own word: it is handed a vetted one, because the first time it
 * chose it invented a gloss for a Tamil word and was wrong. Exactly ONE word
 * is confirmed. So `pickWord` returned অভিমান every time, for every seed —
 * `seed % 1` is always 0.
 *
 * ⛔ AND THE FILE PREDICTED THIS AND WAS WRONG ABOUT THE REMEDY.
 * untranslatableWords.ts says "one confirmed word is one post" and expected
 * the subject register to stop the second: "the angle quietly stops being
 * available rather than publishing the same thought twice". A check on
 * WORDING cannot see sameness of SUBSTANCE. Counting what the angle has spent
 * can, and it is not a judgement call.
 */

import { describe, it, expect } from "vitest";
process.env.SOCIAL_TOKEN_KEY ??= Buffer.alloc(32, 9).toString("base64");

import { usablePools, nextPool } from "@/lib/social/pipeline";
import { vettedWords, pickWord } from "@/lib/social/untranslatableWords";
import { vettedMistakes } from "@/lib/social/productMistakes";

const POOLS = ["privacy", "quiet-hours", "untranslatable", "the-unsaid"];

describe("the cause, pinned so it cannot be forgotten", () => {
  it("pickWord returns the SAME word for every seed when one is confirmed", () => {
    // ⚠️ Not a criticism of pickWord — `seed % 1` is always 0 and that is
    // correct. It is why the pool, not the pick, has to stand down.
    const vetted = vettedWords();
    if (vetted.length === 1) {
      const picks = [0, 1, 2, 7, 93, 1000].map((n) => pickWord(n)?.roman);
      expect(new Set(picks).size).toBe(1);
    }
  });
});

describe("an angle stands down once its material is spent", () => {
  it("⛔ drops `untranslatable` once every confirmed word has been used", () => {
    const n = vettedWords().length;
    expect(usablePools(POOLS, { untranslatable: n })).not.toContain("untranslatable");
    expect(usablePools(POOLS, { untranslatable: n + 5 })).not.toContain("untranslatable");
  });

  it("keeps it while material is left", () => {
    const n = vettedWords().length;
    expect(usablePools(POOLS, { untranslatable: n - 1 })).toContain("untranslatable");
    expect(usablePools(POOLS, {})).toContain("untranslatable");
  });

  it("the same rule for `built-wrong`, which is handed a real mistake", () => {
    /**
     * 🔴 MEASURED: with nothing confirmed, `mistakesPoolReady()` already drops
     * this angle, so the exhaustion branch is UNREACHABLE through the real
     * counts — and a mutation deleting it survived. ⛔ A rule that cannot be
     * exercised is a rule nobody notices breaking on the day the first
     * mistake is confirmed.
     *
     * ⇒ So the limits are injectable, and this test supplies the world where
     * two mistakes exist.
     */
    const pools = [...POOLS, "built-wrong"];
    expect(vettedMistakes().length).toBe(0); // today's truth, stated not assumed

    const asIfConfirmed = { untranslatable: 1, "built-wrong": 2 };
    expect(usablePools(pools, { "built-wrong": 1 }, asIfConfirmed)).toContain("built-wrong");
    expect(usablePools(pools, { "built-wrong": 2 }, asIfConfirmed)).not.toContain("built-wrong");
    expect(usablePools(pools, { "built-wrong": 9 }, asIfConfirmed)).not.toContain("built-wrong");
  });

  it("⛔ leaves the open-ended angles alone, however many they have spent", () => {
    /**
     * 🔴 THE OVER-CORRECTION THIS GUARDS. `privacy` and `the-unsaid` are
     * directions, not material — there is no finite list to exhaust, and
     * retiring them on a count would silence the schedule entirely after a
     * few weeks. ⚠️ Only the HANDED-OVER angles are finite.
     */
    const spent = { privacy: 500, "quiet-hours": 500, "the-unsaid": 500, languages: 500 };
    const left = usablePools(POOLS, spent);
    expect(left).toContain("privacy");
    expect(left).toContain("quiet-hours");
    expect(left).toContain("the-unsaid");
  });

  it("the rotation then runs over what is left, and still never returns a dropped angle", () => {
    // ⛔ The real failure would be `nextPool` indexing into the ORIGINAL list
    // while `usablePools` filtered a copy — the angle is dropped on paper and
    // handed over anyway.
    const left = usablePools(POOLS, { untranslatable: 99 });
    const seen = new Set(Array.from({ length: 40 }, (_, i) => nextPool(left, i)));
    expect(seen.has("untranslatable")).toBe(false);
    expect(seen.size).toBe(left.length);
  });

  it("⛔ never empties the list entirely", () => {
    // A schedule with nothing to write about throws, by design. That must be
    // caused by an empty SCHEDULE, never by this filter eating the last angle.
    expect(usablePools(["untranslatable", "privacy"], { untranslatable: 99 })).toEqual(["privacy"]);
  });
});
