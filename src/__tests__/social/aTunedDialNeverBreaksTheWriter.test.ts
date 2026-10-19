/**
 * ⛔ A TUNING TABLE MAY CHANGE WHAT IS WRITTEN. IT MAY NOT STOP IT BEING
 * WRITTEN, AND IT MAY NOT INSTRUCT SOMETHING ABSURD.
 *
 * 🔑 THE OWNER'S QUESTION, 19 Oct: are the per-platform rules in the database
 * "for continual fine tuning"? They were not — every number was a literal, so
 * acting on a measurement meant shipping a build, and a number that needs a
 * deploy is a number nobody changes.
 *
 * 🔴 AND THE TWO WAYS THIS GOES WRONG, both pinned below:
 *
 *   • THE TABLE BECOMES THE TRUTH. An outage, a missing migration or an empty
 *     table then writes 0-character posts with 0 tags and nothing says why.
 *     ⇒ The code is the default; the table only ever improves on it.
 *
 *   • A BAD ROW IS OBEYED BY BOTH HALVES. These numbers go into the PROMPT and
 *     into the CHECK. `hashtags = 400` throws nothing: the writer is told to
 *     produce 400 and the gate, reading the same row, agrees that is fine.
 *     Both halves move together, so neither catches it
 *     ⇒ trap_a_guard_satisfied_by_a_neighbouring_value.
 */

import { describe, it, expect } from "vitest";
process.env.SOCIAL_TOKEN_KEY ??= Buffer.alloc(32, 9).toString("base64");

import { codeDials, allCodeDials, dialsAreSane, type Dials } from "@/lib/social/platformDials";
import { PLATFORMS, PLATFORM_IDS } from "@/lib/social/platforms";
import { checkHouseStyle } from "@/lib/social/voiceGate";

const sane: Dials = { bodyTarget: { min: 200, max: 400 }, hashtags: 2, emoji: 1, tagsDriveDiscovery: false };

describe("the code is the default, not the table", () => {
  it("every channel has built-in dials that match its spec", () => {
    for (const id of PLATFORM_IDS) {
      const d = codeDials(id);
      expect(d.bodyTarget).toEqual(PLATFORMS[id].bodyTarget);
      expect(d.hashtags).toBe(PLATFORMS[id].hashtags);
      expect(d.emoji).toBe(PLATFORMS[id].emoji);
      expect(d.tagsDriveDiscovery).toBe(PLATFORMS[id].tagsDriveDiscovery);
    }
    expect(Object.keys(allCodeDials()).sort()).toEqual([...PLATFORM_IDS].sort());
  });

  it("⛔ every built-in value is itself sane", () => {
    // 🔑 Or the validator would reject the fallback it falls back TO, and a
    // database outage would be worse than a bad row.
    for (const id of PLATFORM_IDS) {
      expect(dialsAreSane(codeDials(id)), `${id}'s built-in dials fail the check`).toBe(true);
    }
  });

  it("⛔ refuses an unknown channel instead of inventing numbers", () => {
    /**
     * 🔴 `checkHouseStyle` already refuses a channel it does not know, loudly,
     * and that refusal is the better error. Handing out plausible defaults
     * here would make an unknown platform look checked
     * ⇒ the `hasOwn` argument in voiceGate.
     */
    expect(() => codeDials("mastodon")).toThrow(/not a channel/i);
    expect(() => codeDials("constructor")).toThrow(/not a channel/i);
  });

  it("returns a copy, so a caller cannot edit the code's values", () => {
    const a = codeDials("facebook");
    a.bodyTarget.min = 1;
    expect(codeDials("facebook").bodyTarget.min).toBe(PLATFORMS.facebook.bodyTarget.min);
  });
});

describe("a nonsense row is rejected, not obeyed", () => {
  it("accepts a reasonable set", () => {
    expect(dialsAreSane(sane)).toBe(true);
  });

  it("⛔ rejects the values that would instruct something absurd", () => {
    const bad: [string, Dials][] = [
      ["400 hashtags", { ...sane, hashtags: 400 }],
      ["negative hashtags", { ...sane, hashtags: -1 }],
      ["a wall of emoji", { ...sane, emoji: 40 }],
      ["a max below the min", { ...sane, bodyTarget: { min: 400, max: 200 } }],
      ["max equal to min", { ...sane, bodyTarget: { min: 300, max: 300 } }],
      ["a floor of nothing", { ...sane, bodyTarget: { min: 0, max: 400 } }],
      ["a 9,000-character post", { ...sane, bodyTarget: { min: 200, max: 9_000 } }],
      ["a fractional target", { ...sane, bodyTarget: { min: 200.5, max: 400 } }],
      ["NaN from an empty column", { ...sane, hashtags: Number.NaN }],
    ];
    for (const [why, d] of bad) {
      expect(dialsAreSane(d), `${why} was accepted`).toBe(false);
    }
  });

  it("⚠️ rejects a non-boolean discovery flag", () => {
    // 🔑 `tags_drive_discovery` arrives from a driver, and a null column is
    // not false — it is a column nobody filled in.
    expect(dialsAreSane({ ...sane, tagsDriveDiscovery: null as unknown as boolean })).toBe(false);
  });
});

describe("the check and the prompt move together", () => {
  it("a tuned ceiling changes what the gate objects to", () => {
    /**
     * 🔑 THE POINT OF THE WHOLE EXERCISE, from the other end: tuning the row
     * must change the JUDGEMENT too, or the writer is told one thing and
     * marked against another.
     */
    const body = "A sentence about the hours nobody staffs. #one #two #three";
    const strict = checkHouseStyle(body, "facebook"); // built-in: 0 tags
    expect(strict.problems.join(" ")).toMatch(/hashtags/);

    const loosened = checkHouseStyle(body, "facebook", { ...sane, hashtags: 3 });
    expect(loosened.problems.join(" "), "the tuned ceiling was ignored").not.toMatch(/at most 3/i);
  });

  it("a tuned floor changes what counts as too short", () => {
    const short = "Two sentences. That is all.";
    const asIs = checkHouseStyle(short, "facebook");
    expect(asIs.problems.join(" ")).toMatch(/short for/i);

    const relaxed = checkHouseStyle(short, "facebook", { ...sane, bodyTarget: { min: 20, max: 400 } });
    expect(relaxed.problems.join(" "), "still called short against a floor of 20").not.toMatch(/short for/i);
  });

  it("⛔ a tuning row cannot raise a PLATFORM limit", () => {
    /**
     * 🔴 THE LINE THE TABLE MAY NOT CROSS. The hard ceiling, the fold,
     * `linksInBody` and `requiresPicture` are facts about the platform, not
     * opinions of ours. A row that could widen X's 280 characters would
     * produce posts X rejects — and the symptom would be a channel going
     * quiet ⇒ trap_a_dead_cron_fails_where_nobody_is_watching.
     */
    const tooLong = "x".repeat(400);
    const withAbsurdDials = checkHouseStyle(tooLong, "x", {
      bodyTarget: { min: 40, max: 3_000 },
      hashtags: 10,
      emoji: 5,
      tagsDriveDiscovery: false,
    });
    expect(withAbsurdDials.problems.join(" ")).toMatch(/will not accept more than 280/);
  });

  it("⛔ and still refuses a channel it does not know", () => {
    const r = checkHouseStyle("Anything at all.", "mastodon");
    expect(r.ok).toBe(false);
    expect(r.problems.join(" ")).toMatch(/not a channel/i);
  });
});
