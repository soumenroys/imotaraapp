/**
 * 🔴 A CAROUSEL MULTIPLIES THE PLACES A CLAIM CAN GET OUT.
 *
 * Every slide is a card a reader sees, on a permanent public post. The subject
 * and body have been through the word check since the beginning; slides are
 * new, and a slide that skipped it would be the easiest place in this whole
 * system for something to escape.
 *
 * ⛔ And the second rule here: slides are ASKED FOR, never cut out of the
 * body. Splitting on sentence ends changes how many cards publish the moment
 * an abbreviation, a decimal or a quoted full stop appears.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseWritten } from "@/lib/social/writer";
import { mediaKindFor } from "@/lib/social/pipeline";
import { CONTENT_TYPES, SHAPE_LABELS } from "@/lib/social/contentTypes";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const strip = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const pipeline = strip(read("src/lib/social/pipeline.ts"));
const writer = read("src/lib/social/writer.ts");

const reply = (obj: unknown) => JSON.stringify(obj);

describe("the gate reads every slide", () => {
  it("puts the slides into checkVoice alongside the subject and body", () => {
    /**
     * ⚠️ Pinned on the CALL, not on the presence of the word "slides"
     * somewhere in the file — the import line and the type have satisfied
     * that kind of assertion three times in this codebase already.
     */
    const at = pipeline.indexOf("const gate = checkVoice(");
    expect(at).toBeGreaterThan(-1);
    const call = pipeline.slice(at, at + 260);
    expect(call).toContain("slideText");

    const built = pipeline.indexOf("const slideText =");
    expect(built).toBeGreaterThan(-1);
    expect(built).toBeLessThan(at);
    expect(pipeline.slice(built, at)).toContain("written.slides");
  });
});

describe("slides are asked for, not cut out of the body", () => {
  it("the carousel reply shape requests a slides array", () => {
    const at = writer.indexOf("function responseShape");
    const fn = writer.slice(at, at + 2200);
    expect(fn).toContain('"slides"');
    // ⛔ And the subject is named as the FIRST card, so slide one does not
    // repeat the headline and waste the opening swipe.
    expect(fn).toMatch(/FIRST CARD/i);
    expect(fn).toMatch(/Do not repeat the subject/i);
  });

  it("⛔ nothing splits the body into slides", () => {
    // The fragile design this replaced. If it ever reappears, it will appear
    // as a split on sentence ends.
    expect(pipeline).not.toMatch(/slides\s*=\s*body\.split/);
    expect(strip(writer)).not.toMatch(/slides\s*=\s*body\.split/);
  });
});

describe("parsing a reply that carries slides", () => {
  it("keeps the slides in order", () => {
    const w = parseWritten(
      reply({ subject: "How restlessness shows up", body: "A caption.", slides: ["One.", "Two.", "Three."] }),
    );
    expect(w.slides).toEqual(["One.", "Two.", "Three."]);
  });

  it("⛔ drops anything that is not a usable string", () => {
    /**
     * 🔴 A slide rendered from `null` is a BLANK CARD published in the middle
     * of a carousel — visible to everyone, explicable by nobody. ⛔ Dropped,
     * never coerced to "null" or to an empty card.
     */
    const w = parseWritten(
      reply({
        subject: "S",
        body: "B",
        slides: ["Real.", null, "", "   ", 42, { x: 1 }, "Also real."],
      }),
    );
    expect(w.slides).toEqual(["Real.", "Also real."]);
  });

  it("caps at nine, because the subject is the tenth card", () => {
    // ⚠️ Instagram takes 2–10 items. The subject is card one, so at most nine
    // may follow. Trimmed here rather than failing at publish: the post is
    // still good at nine.
    const many = Array.from({ length: 14 }, (_, i) => `Slide ${i + 1}.`);
    const w = parseWritten(reply({ subject: "S", body: "B", slides: many }));
    expect(w.slides).toHaveLength(9);
    expect(w.slides?.[8]).toBe("Slide 9.");
  });

  it("leaves slides undefined when there are none, rather than empty", () => {
    // ⚠️ `[]` and "this is not a carousel" are different facts, and the
    // publisher branches on the difference.
    expect(parseWritten(reply({ subject: "S", body: "B" })).slides).toBeUndefined();
    expect(parseWritten(reply({ subject: "S", body: "B", slides: [] })).slides).toBeUndefined();
    expect(parseWritten(reply({ subject: "S", body: "B", slides: [null, ""] })).slides).toBeUndefined();
  });

  it("still refuses a reply with no subject or no body", () => {
    // ⛔ Unchanged by any of this: an empty subject would poison the register.
    expect(() => parseWritten(reply({ subject: "", body: "B", slides: ["x"] }))).toThrow();
    expect(() => parseWritten(reply({ subject: "S", body: "", slides: ["x"] }))).toThrow();
  });
});

describe("the shape is known everywhere it has to be", () => {
  it("is a content type with a label", () => {
    expect([...CONTENT_TYPES]).toContain("carousel");
    expect(SHAPE_LABELS.carousel).toBeTruthy();
  });

  it("becomes its own media kind, not a plain graphic", () => {
    /**
     * ⛔ Without this a carousel would be stored as "graphic" and publish as a
     * SINGLE card, silently losing every slide the writer produced — and
     * looking entirely normal while doing it.
     */
    expect(mediaKindFor("carousel", true)).toBe("carousel");
    expect(mediaKindFor("text_graphic", true)).toBe("graphic");
  });

  it("⛔ is still 'none' when no card could be made", () => {
    // The picture machinery is shared: no picture, no carousel.
    expect(mediaKindFor("carousel", false)).toBe("none");
  });

  it("the database constraint names it too", () => {
    // 🔴 The copy that cannot import the others, and the one that was missed
    // when short_video and animated_gif were added.
    const sql = read("docs/sql/social_autopost_v1.sql");
    expect(sql).toMatch(/check \(content_type in \([^)]*'carousel'/);
    expect(sql).toMatch(/check \(media_kind in \([^)]*'carousel'/);
  });
});
