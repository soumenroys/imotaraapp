/**
 * ⛔ THE THREE CHANNELS WERE MARCHING IN LOCKSTEP.
 *
 * 🔴 MEASURED 20 Oct 2026, by reading the queue rather than by any test. Thirty
 * minutes apart, on the same evening:
 *   18:30 YouTube  — "No names shared, unless you switch it on"
 *   19:00 Instagram — "No sync unless you choose it"
 * and across the three schedules, five "Abhimaan: …" variations and six
 * versions of the unsent-message idea.
 *
 * 🔑 THE CAUSE, and it was not where I first said it was. The angle comes from
 * `nextPool(cycle, postsSoFar)` and `postsSoFar` is `postCountFor(schedule.id)`
 * — **per schedule**. Facebook's and YouTube's `topic_pool` lists are
 * character-for-character identical, so the two walk the same cycle and land on
 * the same angle on the same day, indefinitely.
 *
 * ⛔ AND THE SUBJECT GUARD CANNOT SEE IT. `judgeSubject` already looks across
 * every channel — but it compares WORDS. Those two subjects share none of the
 * meaningful ones, so the overlap is near zero and both pass honestly. ⇒ **a
 * lexical check cannot catch a semantic repeat**, and the writer never repeats
 * a string; it paraphrases, endlessly, and every paraphrase is a fresh hash.
 *
 * ⚠️ So the fix belongs at the ANGLE, not the wording
 * ⇒ trap_a_menu_handed_to_a_model_is_not_a_rotation.
 */

import { describe, it, expect } from "vitest";
import { poolsLeftForToday, istDayWindow, IST_OFFSET_MS } from "@/lib/social/pipeline";
import { judgeSubject } from "@/lib/social/subjects";

const POOLS = ["privacy", "quiet-hours", "untranslatable", "the-unsaid", "built-wrong"];

describe("the angles one day has not spent yet", () => {
  it("🔴 drops what another channel already used today", () => {
    expect(poolsLeftForToday(POOLS, ["privacy"])).toEqual([
      "quiet-hours",
      "untranslatable",
      "the-unsaid",
      "built-wrong",
    ]);
  });

  it("drops several, and keeps the order of what is left", () => {
    expect(poolsLeftForToday(POOLS, ["quiet-hours", "built-wrong"])).toEqual([
      "privacy",
      "untranslatable",
      "the-unsaid",
    ]);
  });

  it("changes nothing on the first post of the day", () => {
    expect(poolsLeftForToday(POOLS, [])).toEqual(POOLS);
  });

  /**
   * 🔴 THE MOST IMPORTANT RULE IN THE FILE.
   *
   * ⛔ Dropping every angle would stop the channel posting at all — trading a
   * repeat for a SILENCE, which is strictly worse and is the exact failure
   * `queueHealth` exists for. A repeat is a dull post; a silence is no post.
   */
  it("⛔ never empties — a silence is worse than a repeat", () => {
    expect(poolsLeftForToday(POOLS, POOLS)).toEqual(POOLS);
    expect(poolsLeftForToday(["privacy"], ["privacy"])).toEqual(["privacy"]);
  });

  it("⚠️ an angle used today that this channel never had is simply ignored", () => {
    // Instagram carries `ways-of-saying`; Facebook does not. Facebook's list
    // must not be disturbed by Instagram having spent it.
    expect(poolsLeftForToday(POOLS, ["ways-of-saying"])).toEqual(POOLS);
  });

  it("⛔ pure — it does not mutate what it is given", () => {
    const available = [...POOLS];
    const used = ["privacy"];
    poolsLeftForToday(available, used);
    expect(available).toEqual(POOLS);
    expect(used).toEqual(["privacy"]);
  });
});

describe("the day, in Kolkata, as a UTC window", () => {
  it("🔑 covers the evening slots that actually exist", () => {
    // 18:30, 19:00 and 19:30 IST are 13:00Z, 13:30Z and 14:00Z.
    const { from, to } = istDayWindow("2026-10-20T13:00:00.000Z");
    expect(from).toBe("2026-10-19T18:30:00.000Z"); // 20 Oct 00:00 IST
    expect(to).toBe("2026-10-20T18:30:00.000Z"); // 21 Oct 00:00 IST
    for (const slot of ["2026-10-20T13:00:00.000Z", "2026-10-20T13:30:00.000Z", "2026-10-20T14:00:00.000Z"]) {
      expect(slot >= from && slot < to, `${slot} fell outside its own day`).toBe(true);
    }
  });

  it("⛔ a slot after midnight IST belongs to the NEXT day, not the previous one", () => {
    /**
     * 🔑 THE REASON THIS IS NOT JUST `toISOString().slice(0,10)`. 01:00 IST is
     * 19:30Z the day BEFORE, so a UTC-day key would file a late-night post
     * under yesterday and let the angle repeat.
     */
    const lateNight = "2026-10-20T19:30:00.000Z"; // 21 Oct, 01:00 IST
    const { from, to } = istDayWindow(lateNight);
    expect(from).toBe("2026-10-20T18:30:00.000Z"); // 21 Oct 00:00 IST
    expect(to).toBe("2026-10-21T18:30:00.000Z");
  });

  it("every instant falls in exactly one day, and the windows abut with no gap", () => {
    const a = istDayWindow("2026-10-20T13:00:00.000Z");
    const b = istDayWindow("2026-10-21T13:00:00.000Z");
    expect(a.to).toBe(b.from);
  });

  it("⚠️ the offset is India's, and it is a constant because India has no DST", () => {
    expect(IST_OFFSET_MS).toBe(19_800_000);
    // The same window in January, when a DST country would have shifted.
    expect(istDayWindow("2026-01-15T13:00:00.000Z").from).toBe("2026-01-14T18:30:00.000Z");
  });

  it("⛔ refuses a date it cannot read rather than inventing a day", () => {
    expect(() => istDayWindow("not a date")).toThrow(/real date/i);
  });
});

describe("⛔ why the existing subject guard could not have caught this", () => {
  it("🔴 the two live subjects share almost no words, so the overlap check passes both", () => {
    /**
     * ⚠️ THE CONTROL FOR THE WHOLE FIX. If this ever starts failing, the
     * lexical guard has grown teeth and the angle narrowing might be
     * redundant — but today it passes, which is why those two went out.
     */
    const verdict = judgeSubject("No sync unless you choose it", [
      "No names shared, unless you switch it on",
    ]);
    expect(verdict.ok, "the word-overlap guard caught it after all").toBe(true);
  });

  it("…while it still catches a genuine near-duplicate", () => {
    const verdict = judgeSubject("The people who think in Odia", ["The people who think in Odia"]);
    expect(verdict.ok).toBe(false);
  });
});
