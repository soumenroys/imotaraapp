/**
 * 🔴 THE SAFETY CLAUSE ON A GENERATED PICTURE IS NOT A STYLE NOTE.
 *
 * Imotara is a mental-health product. A generated illustration that shows
 * distress, a clinical setting, or a face that reads as a real person is not a
 * poor card — it is a liability and a betrayal of the reader. This is the same
 * class of risk as the regulated-title copy caught FOUR times in material
 * written by people who knew the rules
 * ⇒ trap_marketing_copy_claims_a_regulated_title.
 *
 * ⚠️ AND NO LETTERS. The renderer draws the words. A picture carrying its own
 * text puts two headlines on one card, in a typeface nobody chose — and in a
 * script the model cannot shape ⇒ trap_a_card_cannot_draw_an_indic_script.
 */

import { describe, it, expect } from "vitest";
import {
  ILLUSTRATION_STYLES,
  SAFETY_CLAUSE,
  illustrationPrompt,
  styleById,
  firstInlineImage,
  styleForPost,
} from "@/lib/social/illustration";

describe("every prompt carries the safety clause", () => {
  it("🔴 on every style, with or without a mood", () => {
    for (const s of ILLUSTRATION_STYLES) {
      expect(illustrationPrompt(s, null), `${s.id} without a mood`).toContain(SAFETY_CLAUSE);
      expect(illustrationPrompt(s, "awake at 3am"), `${s.id} with a mood`).toContain(SAFETY_CLAUSE);
    }
  });

  it("⛔ the clause is LAST, so nothing is weighed after it", () => {
    /**
     * 🔑 A requirement buried mid-prompt is one the model balances against
     * everything that follows. Stated last, it is the final instruction.
     */
    for (const s of ILLUSTRATION_STYLES) {
      expect(illustrationPrompt(s, "a quiet evening").trimEnd().endsWith(SAFETY_CLAUSE)).toBe(true);
    }
  });

  it("⚠️ it is appended centrally, so a style added later cannot omit it", () => {
    // ⛔ The failure this prevents: a sixth style written without the clause
    // ⇒ trap_a_constraint_nobody_told_the_writer.
    for (const s of ILLUSTRATION_STYLES) {
      // ⚠️ Caught a real one: `night-window` said "No people." itself. Harmless
      // on its own — but a rule living in two places drifts, and the copy in
      // the style is the one nobody updates.
      expect(s.look.toLowerCase(), `${s.id} writes its own safety rules`).not.toMatch(
        /\bno (people|faces|text|humans)\b/,
      );
    }
  });

  it("🔴 names the things that must never appear", () => {
    for (const forbidden of ["faces", "text", "clinical", "self-harm", "logos"]) {
      expect(SAFETY_CLAUSE.toLowerCase()).toContain(forbidden);
    }
  });

  it("⚠️ the mood is passed as a feeling, never as something to depict", () => {
    /**
     * ⛔ "Illustrate: someone awake at 3am" lands on exactly the imagery the
     * clause forbids. The mood must arrive hedged.
     */
    const p = illustrationPrompt(ILLUSTRATION_STYLES[0], "someone awake at 3am");
    expect(p).toMatch(/without depicting it literally/i);
  });
});

describe("the styles themselves", () => {
  it("every style is reachable by its id", () => {
    for (const s of ILLUSTRATION_STYLES) expect(styleById(s.id)).toBe(s);
    expect(styleById("no-such-style")).toBeUndefined();
  });

  it("⚠️ no style asks for a person — the clause is the floor, not the only guard", () => {
    for (const s of ILLUSTRATION_STYLES) {
      expect(s.look.toLowerCase(), `${s.id} describes people`).not.toMatch(
        /\b(person|people|woman|man|child|portrait|face)\b/,
      );
    }
  });

  it("each has a one-line note, so the owner can choose without reading prompts", () => {
    for (const s of ILLUSTRATION_STYLES) {
      expect(s.note.length, `${s.id} has no note`).toBeGreaterThan(10);
      expect(s.label.length).toBeGreaterThan(2);
    }
  });
});

describe("⛔ reading the reply, whichever spelling it uses", () => {
  /**
   * 🔑 The REST API returns camelCase and the SDK documents snake_case, and
   * the published examples disagree about the HTTP surface. This could not be
   * verified locally — the key is an empty string in `.env.local` — so the
   * parser accepts either rather than silently finding nothing.
   */
  it("finds a camelCase image part", () => {
    const body = { candidates: [{ content: { parts: [{ inlineData: { data: "QUJD", mimeType: "image/png" } }] } }] };
    expect(firstInlineImage(body)).toEqual({ data: "QUJD", mimeType: "image/png" });
  });

  it("finds a snake_case image part", () => {
    const body = { candidates: [{ content: { parts: [{ inline_data: { data: "QUJD", mime_type: "image/jpeg" } }] } }] };
    expect(firstInlineImage(body)).toEqual({ data: "QUJD", mimeType: "image/jpeg" });
  });

  it("skips a text part and finds the image after it", () => {
    const body = {
      candidates: [{ content: { parts: [{ text: "here you go" }, { inlineData: { data: "QUJD" } }] } }],
    };
    expect(firstInlineImage(body)?.data).toBe("QUJD");
  });

  it("⛔ returns null rather than inventing an image", () => {
    expect(firstInlineImage({})).toBeNull();
    expect(firstInlineImage({ candidates: [] })).toBeNull();
    expect(firstInlineImage({ candidates: [{ content: { parts: [{ text: "refused" }] } }] })).toBeNull();
    expect(firstInlineImage({ candidates: [{ content: { parts: [{ inlineData: {} }] } }] })).toBeNull();
  });
});

/**
 * 🔴 THE STYLE ROTATION, AND THE BUG IT IS BUILT NOT TO REPEAT.
 *
 * The owner chose to rotate all five styles rather than settle on one. ⛔ The
 * obvious way to do that — index by the schedule's own post count — is
 * EXACTLY the bug found live this morning: the ANGLE rotation is keyed on
 * `postCountFor(schedule.id)`, Facebook's and YouTube's pools are identical,
 * and the two walked one cycle in lockstep and posted the same idea thirty
 * minutes apart. A style rotation keyed the same way would give all three
 * channels one style per day — the precise failure illustrations exist to end.
 */
describe("which style this post gets", () => {
  const ids = ILLUSTRATION_STYLES.map((s) => s.id);

  it("walks every style before repeating one", () => {
    const seen = ids.map((_, i) => styleForPost(i).id);
    expect([...new Set(seen)].sort()).toEqual([...ids].sort());
  });

  it("🔴 a second channel on the same day gets a DIFFERENT style", () => {
    const first = styleForPost(0).id;
    const second = styleForPost(0, [first]).id;
    expect(second, "the second channel repeated the first channel's style").not.toBe(first);
  });

  it("⛔ and a third differs from both", () => {
    const a = styleForPost(0).id;
    const b = styleForPost(0, [a]).id;
    const c = styleForPost(0, [a, b]).id;
    expect(new Set([a, b, c]).size).toBe(3);
  });

  it("⛔ never returns nothing when the day has spent them all", () => {
    /**
     * 🔑 Same rule as the angle narrowing, same reason: with more channels in
     * a day than styles, dropping every one would leave the post with no
     * picture — and a missing illustration is worse than a repeated one.
     */
    const s = styleForPost(2, ids);
    expect(ids).toContain(s.id);
  });

  it("is deterministic, so the same post always gets the same style", () => {
    expect(styleForPost(3).id).toBe(styleForPost(3).id);
  });

  it("⛔ refuses a count it cannot use rather than silently picking the first", () => {
    expect(() => styleForPost(-1)).toThrow();
    expect(() => styleForPost(Number.NaN)).toThrow();
    expect(() => styleForPost(0, [], [])).toThrow(/no styles/i);
  });
});
