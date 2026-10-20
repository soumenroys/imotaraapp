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
  stylesForAngle,
  TONES_FOR_ANGLE,
} from "@/lib/social/illustration";
import { styleWindow, STYLE_WINDOW_DAYS } from "@/lib/social/giveAPicture";

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

  it("⚠️ no style asks for a PHOTOREALISTIC person — corrected 20 Oct", () => {
    /**
     * 🔴 THIS TEST USED TO FORBID PEOPLE ENTIRELY, and that was my caution
     * rather than the brief. The owner's 27 reference posts are full of drawn
     * characters, and that is where their warmth comes from — a girl dancing,
     * a child with a giraffe.
     *
     * ⛔ The real risk was never "a person". It is a PHOTOREALISTIC face that
     * reads as an identifiable human being, which a mental-health brand must
     * not appear to be photographing. So a style may ask for a character; it
     * may not ask for a portrait.
     */
    for (const s of ILLUSTRATION_STYLES) {
      expect(s.look.toLowerCase(), `${s.id} asks for a photographic person`).not.toMatch(
        /\b(portrait|photorealistic (person|face)|real person|model posing)\b/,
      );
    }
  });

  it("🔑 …and a character IS allowed, so the correction actually took", () => {
    // ⛔ The control. If this ever finds nothing, the catalogue has drifted
    // back to abstract-only and the warmth the owner asked for is gone.
    const withCharacters = ILLUSTRATION_STYLES.filter((s) =>
      /\b(character|animals?|figure)\b/.test(s.look.toLowerCase()),
    );
    expect(withCharacters.length, "no style draws a character any more").toBeGreaterThan(0);
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
    expect(() => styleForPost(0, [], null, [])).toThrow(/no styles/i);
  });
});

/**
 * 🔴 THE PICTURE MUST SUIT THE WORDS.
 *
 * The owner, after reviewing all twelve: *"be careful, whatever you write on
 * the image, that should be aligned with the background image."*
 *
 * ⛔ THE FAILURE THIS PREVENTS is not cosmetic. The `quiet-hours` angle writes
 * about three in the morning, the phone sitting silent, "the hour nobody
 * answers". Rotating styles blindly would eventually set one of those over
 * the children's-book fox picnic — and a picture that cheerful behind a
 * sentence that lonely does not read as variety. It reads as nobody looking.
 *
 * ⚠️ "quiet" is NOT "sad". Imotara never publishes bleak imagery. It means
 * still and unhurried — a dusk field rather than a party.
 */
describe("the picture suits what the post is about", () => {
  it("🔴 a post about the small hours never draws a bright style", () => {
    const fit = stylesForAngle("quiet-hours");
    expect(fit.length, "quiet-hours was left with nothing").toBeGreaterThan(0);
    for (const s of fit) {
      expect(s.tones, `${s.id} is offered to a quiet-hours post`).toContain("quiet");
    }
    expect(fit.map((s) => s.id)).not.toContain("childrens-book");
    expect(fit.map((s) => s.id)).not.toContain("flat-vector-scene");
  });

  it("⚠️ and the rotation honours it, not just the filter", () => {
    /**
     * 🔑 The reachability half. `stylesForAngle` is pure and the rotation is
     * free to ignore it — which is exactly the shape of bug that left
     * `support` unused by every render route for weeks.
     */
    for (let i = 0; i < 12; i++) {
      const picked = styleForPost(i, [], "quiet-hours");
      expect(picked.tones, `post ${i} drew ${picked.id} for a quiet-hours subject`).toContain("quiet");
    }
  });

  it("⛔ tone outranks not-repeating", () => {
    /**
     * ⛔ THE ORDERING THAT MATTERS. If the day's spent styles were removed
     * FIRST and the result were empty, the fallback would hand back the whole
     * catalogue — quietly reintroducing the cheerful picture on the lonely
     * post that this exists to prevent. Suiting the words wins.
     */
    const quiet = stylesForAngle("quiet-hours").map((s) => s.id);
    /**
     * ⚠️ EVERY INDEX, not just zero. The first version of this test passed
     * `postsSoFar: 0` only — and with the whole catalogue as the fallback,
     * index 0 happens to land on a quiet style anyway, so the test passed with
     * the bug in place. Found by mutation
     * ⇒ trap_mutation_harness_can_report_false_caught.
     */
    for (let i = 0; i < ILLUSTRATION_STYLES.length; i++) {
      const picked = styleForPost(i, quiet, "quiet-hours");
      expect(quiet, `post ${i} escaped the tone filter to avoid a repeat: ${picked.id}`).toContain(
        picked.id,
      );
    }
  });

  it("an open angle keeps the whole catalogue, so variety is not narrowed for nothing", () => {
    expect(stylesForAngle("privacy").length).toBe(ILLUSTRATION_STYLES.length);
  });

  it("⛔ an unknown or missing angle is never left without a picture", () => {
    expect(stylesForAngle(null).length).toBe(ILLUSTRATION_STYLES.length);
    expect(stylesForAngle("an-angle-added-next-year").length).toBe(ILLUSTRATION_STYLES.length);
  });

  it("⚠️ every style can carry at least one tone, or it can never be chosen", () => {
    for (const s of ILLUSTRATION_STYLES) {
      expect(s.tones.length, `${s.id} suits no post at all`).toBeGreaterThan(0);
    }
  });

  it("🔑 every angle the schedules actually use is mapped", () => {
    // ⛔ An unmapped angle silently gets the whole catalogue, which is safe but
    // is NOT alignment — and nobody would find out by looking at a post.
    for (const angle of ["privacy", "quiet-hours", "untranslatable", "the-unsaid", "built-wrong", "ways-of-saying"]) {
      expect(TONES_FOR_ANGLE[angle], `${angle} has no tone mapping`).toBeTruthy();
    }
  });
});

/**
 * 🔴 NOT EVERY CARD MAY BE LIGHT.
 *
 * Drawing all twelve and READING THE MEASUREMENTS showed every single one
 * landing light enough to take dark ink — brightness 164 to 249, spread 3.5
 * to 24.7. Perfectly legible, and a monotony creeping back in by the side
 * door: several of the owner's own references are white-on-dark, and we had
 * quietly lost that look entirely.
 *
 * ⛔ THE MEASUREMENT IS STILL WHAT DECIDES THE INK. `ground` is what the style
 * INTENDED, kept so the two can be compared — a style that asks for night and
 * renders a pale sky is a prompt that is not working, and nobody would ever
 * find out, because the card would still be legible. It would just be the
 * fifteenth light card in a row.
 */
describe("some backgrounds have to be dark", () => {
  it("🔴 the catalogue carries dark-ground styles at all", () => {
    const dark = ILLUSTRATION_STYLES.filter((s) => s.ground === "dark");
    expect(dark.length, "every style is light again — white-on-dark has been lost").toBeGreaterThanOrEqual(3);
  });

  it("⚠️ and light ones, because an all-dark feed is the same mistake inverted", () => {
    expect(ILLUSTRATION_STYLES.filter((s) => s.ground === "light").length).toBeGreaterThan(3);
  });

  it("⛔ a dark style names deep values rather than merely feeling moody", () => {
    /**
     * 🔑 THE PROMPT HAS TO DO THE WORK. The ink is chosen by measurement, so a
     * style that says "night" and renders a pale blue sky takes dark ink like
     * all the rest and this achieves nothing.
     */
    for (const s of ILLUSTRATION_STYLES.filter((x) => x.ground === "dark")) {
      expect(
        s.look.toLowerCase(),
        `${s.id} declares a dark ground without asking for dark values`,
      ).toMatch(/\b(dark|deep|near-black|nocturnal|shadow)\b/);
    }
  });

  it("⚠️ every style declares a ground, so none is dark or light by accident", () => {
    for (const s of ILLUSTRATION_STYLES) {
      expect(["light", "dark"], `${s.id}`).toContain(s.ground);
    }
  });

  it("🔑 a dark style still reserves its quiet area like any other", () => {
    // ⛔ Dark does not excuse a busy frame — white type over a detailed night
    // scene fails exactly as black type over a detailed bright one does.
    for (const s of ILLUSTRATION_STYLES.filter((x) => x.ground === "dark")) {
      expect(s.look.toLowerCase(), `${s.id} reserves no room for the words`).toMatch(
        /\b(plain|almost black|nothing on it|only a faint|dark and plain)\b/,
      );
    }
  });
});

/**
 * 🔴 LEGIBLE IS NOT THE SAME AS RIGHT.
 *
 * Three decisions taken 20 Oct 2026 after rendering real posts and looking at
 * them — none of which any measurement would ever have raised, because all
 * three cards were perfectly readable:
 *
 *  • `photo-field` asked for a photograph and returned a painted illustration
 *    BOTH times it was tried. A style that does not do what its name says
 *    keeps producing surprises, and the surprise lands on a published post.
 *  • `flat-vector-scene` composed cleanly and read like a SaaS landing page
 *    rather than a quiet companion. The owner's call, and the right one.
 *  • `childrens-book` put a cheerful fox-and-badger picnic behind "How
 *    wanting to be alone can show up". `warm` let it reach `the-unsaid`,
 *    which is exactly where it should never land.
 */
describe("styles removed and narrowed by looking", () => {
  it("⛔ the two withdrawn styles are gone", () => {
    const ids = ILLUSTRATION_STYLES.map((s) => s.id);
    expect(ids, "photo-field is back — it never produced a photograph").not.toContain("photo-field");
    expect(ids, "flat-vector-scene is back — too loud for the brand").not.toContain("flat-vector-scene");
  });

  it("🔴 the children's book can never reach an introspective subject", () => {
    /**
     * ⚠️ THE ASSERTION IS ON THE OUTCOME, not on the tag. Pinning
     * `tones === ["bright"]` would pass if `the-unsaid` were later widened to
     * include bright — and the fox would be back behind the quiet sentence.
     */
    for (const angle of ["quiet-hours", "the-unsaid"]) {
      const ids = stylesForAngle(angle).map((s) => s.id);
      expect(ids, `${angle} can draw the children's book`).not.toContain("childrens-book");
    }
  });

  it("⚠️ but it can still be chosen for a genuinely bright subject", () => {
    // ⛔ The control. Narrowing it to nothing would be deleting it the slow way.
    const reachable = ["privacy", "built-wrong", "untranslatable", "ways-of-saying"].some((a) =>
      stylesForAngle(a).some((s) => s.id === "childrens-book"),
    );
    expect(reachable, "the children's book can no longer be chosen at all").toBe(true);
  });

  it("⚠️ every angle still has several styles to choose from", () => {
    /**
     * 🔴 THE REAL RISK OF REMOVING THINGS. Dropping two styles and narrowing a
     * third shrinks what a quiet subject can draw — and a quiet subject with
     * one option is a channel that posts the same picture every time, which is
     * the monotony this all started from.
     */
    for (const angle of ["quiet-hours", "the-unsaid", "untranslatable", "privacy", "built-wrong", "ways-of-saying"]) {
      expect(stylesForAngle(angle).length, `${angle} has too little to choose from`).toBeGreaterThanOrEqual(5);
    }
  });
});

/**
 * 🔴 A STYLE MUST NOT COME BACK THE NEXT MORNING.
 *
 * Narrowing by the DAY alone stopped two channels sharing a style on one
 * evening — and let the same style return the very next day. Six backfilled
 * posts drew `coloured-pencil` TWICE on consecutive days, out of thirteen
 * available. Not wrong, and not the variety that was asked for either.
 */
describe("the window a style may not repeat inside", () => {
  it("🔴 spans the day before and the day after, not just the day", () => {
    const w = styleWindow("2026-10-22T13:00:00.000Z");
    // 21 Oct 00:00 IST → 23 Oct 00:00 IST, i.e. three whole Kolkata days.
    expect(w.from).toBe("2026-10-20T18:30:00.000Z");
    expect(w.to).toBe("2026-10-23T18:30:00.000Z");
  });

  it("⚠️ covers the slot it was asked about", () => {
    // ⛔ A window that excluded its own day would let two channels on one
    // evening share a style — the lockstep bug, back again.
    for (const slot of ["2026-10-22T13:00:00.000Z", "2026-10-22T13:30:00.000Z", "2026-10-22T14:00:00.000Z"]) {
      const w = styleWindow(slot);
      expect(slot >= w.from && slot < w.to, slot).toBe(true);
    }
  });

  it("⛔ three days, because four would make the narrowing meaningless", () => {
    /**
     * 🔑 At three posts a day, a three-day window spends nine of thirteen
     * styles. Four days would spend twelve, leave one, and the never-empty
     * fallback would fire on nearly every post — a narrowing that always falls
     * back is not a narrowing.
     */
    expect(STYLE_WINDOW_DAYS).toBe(3);
    const posts = STYLE_WINDOW_DAYS * 3;
    expect(posts, "the window now spends more styles than exist").toBeLessThan(
      ILLUSTRATION_STYLES.length,
    );
  });

  it("⚠️ and a quiet subject still has somewhere to go when the window is full", () => {
    /**
     * ⛔ The fallback matters MORE now. `quiet-hours` can draw only the quiet
     * styles, and a three-day window can spend most of them — a post with no
     * picture is worse than one with a repeated style.
     */
    const quiet = stylesForAngle("quiet-hours").map((s) => s.id);
    const picked = styleForPost(0, quiet, "quiet-hours");
    expect(quiet).toContain(picked.id);
  });
});
