/**
 * 🔴 THE DEFECT: two of the five shapes existed everywhere except the screen.
 *
 * `short_video` and `animated_gif` were built end to end — the storyboard, the
 * GIF and MP4 encoders, the serving route, the database constraint, the
 * schedule validator, the tests, the knowledgebase and the page's own
 * walkthrough, which told the reader "Shape is text, a picture, both, a short
 * video or an animated GIF". The radio buttons offered three. The branch in
 * NewSchedule that warns a GIF only animates on X could never run.
 *
 * ⚠️ FIVE HAND-KEPT COPIES OF ONE LIST, and the one that was missed was the
 * only one a person ever sees. Four are now derived from contentTypes.ts and a
 * missing label is a compile error. ⛔ The fifth — the database's CHECK
 * constraint — cannot import anything, so it is checked here instead.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CONTENT_TYPES, SHAPE_LABELS } from "@/lib/social/contentTypes";
import { mediaKindFor, wantsAnimation, wantsPicture } from "@/lib/social/pipeline";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

describe("the database agrees with the code about what a shape is", () => {
  const sql = read("docs/sql/social_autopost_v1.sql");

  it("⛔ the content_type constraint names exactly the shapes the code offers", () => {
    /**
     * 🔴 THIS IS THE COPY THAT WAS WRONG IN PRODUCTION. The constraint block in
     * this file lists all five; the LIVE database still carried the original
     * auto-named `social_schedules_content_type_check`, which predates the
     * animation work and rejects `animated_gif`. A file being right is not the
     * database being right — this test guards the first, and only the first.
     */
    const list = sql.match(/check \(content_type in \(([^)]+)\)\)/);
    expect(list, "no content_type CHECK found in the migration").toBeTruthy();
    const inSql = [...(list as RegExpMatchArray)[1].matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
    expect([...inSql].sort()).toEqual([...CONTENT_TYPES].sort());
  });

  it("the media_kind constraint covers every kind the pipeline can produce", () => {
    const list = sql.match(/check \(media_kind in \(([^)]+)\)\)/);
    expect(list).toBeTruthy();
    const inSql = new Set([...(list as RegExpMatchArray)[1].matchAll(/'([a-z_]+)'/g)].map((m) => m[1]));
    for (const ct of CONTENT_TYPES) {
      // ⚠️ hasPicture, because a shape that wanted a card and did not get one
      // stores "none" — the kind follows what was composed, not what was asked.
      const kind = mediaKindFor(ct, wantsPicture(ct));
      expect(inSql.has(kind), `the database would reject media_kind "${kind}", which ${ct} produces`).toBe(true);
    }
  });
});

describe("the form offers every shape", () => {
  const form = read("src/app/admin/social/_components/NewSchedule.tsx");

  it("⛔ builds its radio buttons from the shared list, not by hand", () => {
    // 🔑 The thing that broke was a hand-written array. A test that reads the
    // derived array back would pass on a hand-written one too, so what is
    // checked here is that it is DERIVED.
    expect(form).toMatch(/const SHAPES = CONTENT_TYPES\.map\(/);
    expect(
      /const SHAPES = \[\s*\{/.test(form),
      "SHAPES has gone back to a hand-written list",
    ).toBe(false);
  });

  it("labels every one of them", () => {
    for (const ct of CONTENT_TYPES)
      expect(SHAPE_LABELS[ct], `no label for the ${ct} shape`).toBeTruthy();
  });

  it("⚠️ warns about the animated ones, and can actually reach that warning", () => {
    // The branch existed before the options did. Both halves, or neither.
    expect(form).toContain("animationWarning");
    for (const ct of CONTENT_TYPES.filter(wantsAnimation))
      expect(form, `${ct} is never named in the form`).toContain(ct);
  });
});

describe("the hand-written post offers every shape too", () => {
  const page = read("src/app/admin/social/compose/page.tsx");

  it("\u26d4 builds its radio buttons from the shared list", () => {
    // \ud83d\udd34 This screen was the SIXTH copy and was also two short: a post
    // written by hand could not be a short video or a GIF, although the route
    // it posts to accepts both.
    expect(page).toMatch(/const SHAPES = CONTENT_TYPES\.map\(/);
    expect(/const SHAPES = \[\s*\{/.test(page), "SHAPES is hand-written again").toBe(false);
  });

  it("gives each one a hint", () => {
    for (const ct of CONTENT_TYPES)
      expect(page, `no hint for ${ct}`).toMatch(new RegExp(`\\b${ct}:\\s*"`));
  });
});

describe("the shapes themselves", () => {
  it("every one produces a media kind, and only the animated ones animate", () => {
    expect(CONTENT_TYPES.filter(wantsAnimation)).toEqual(["short_video", "animated_gif"]);
    expect(mediaKindFor("text", false)).toBe("none");
    expect(mediaKindFor("short_video", true)).toBe("short_video");
    expect(mediaKindFor("animated_gif", true)).toBe("animated_gif");
    expect(mediaKindFor("text_graphic", true)).toBe("graphic");
    // ⛔ A card that failed to compose is "none" whatever was asked for.
    expect(mediaKindFor("short_video", false)).toBe("none");
  });

  it("⛔ anything that animates needs the picture it animates, too", () => {
    // 🔑 The animation is the card assembling itself. A shape that animates
    // without composing a card would animate nothing.
    for (const ct of CONTENT_TYPES.filter(wantsAnimation))
      expect(wantsPicture(ct), `${ct} animates but composes no card`).toBe(true);
  });
});
