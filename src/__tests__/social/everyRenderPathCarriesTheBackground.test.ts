/**
 * 🔴 A CARD RENDERED WITHOUT ITS BACKGROUND, SILENTLY.
 *
 * ⛔ THE SHAPE OF BUG THIS GUARDS, and this project has shipped it before:
 * `composePicture` accepted a `support` from the day it was written and no
 * render route ever passed one, so every published card carried no second
 * line — for weeks, with every test green, because each test handed compose
 * the field directly.
 *
 * ⚠️ THE BACKGROUND IS IN EXACTLY THAT POSITION. Four separate routes build a
 * `PictureSource` field by field: the admin preview, the public card route
 * that Instagram fetches, the Facebook publish path, and the video renderer.
 * A route that selects the column and forgets to pass it produces a perfectly
 * good card with no picture, and nothing anywhere would say so.
 *
 * 🔑 THE PUBLISH PATH IS THE ONE THAT MATTERS MOST — its own comment already
 * warns that a field passed in the admin and omitted there means the PUBLISHED
 * card differs from the one somebody approved. That is an approval gate
 * approving something nobody will see.
 */

import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const read = (p: string) =>
  fs
    .readFileSync(path.join(process.cwd(), p), "utf8")
    // ⛔ Comments stripped: the prose explaining this fix must not satisfy it.
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/^\s*\/\/.*$/gm, " ");

const ROUTES = [
  "src/app/api/admin/social/picture/[id]/route.ts",
  "src/app/api/social/card/[id]/route.ts",
  "src/app/api/cron/social-publish/route.ts",
];

describe("every render path carries the background", () => {
  for (const route of ROUTES) {
    it(`${route.split("/").slice(-3).join("/")} selects it`, () => {
      const src = read(route);
      expect(src.length, "the route was not actually read").toBeGreaterThan(500);
      expect(src, "the illustration column is not selected").toMatch(/illustration/);
    });

    it(`${route.split("/").slice(-3).join("/")} passes it to the renderer`, () => {
      /**
       * ⚠️ Anchored on the ASSIGNMENT, not the word. Selecting the column and
       * forgetting to pass it is precisely the failure — and a grep for
       * "illustration" alone would be satisfied by the SELECT.
       */
      expect(read(route)).toMatch(/illustration:\s*post\.illustration/);
    });
  }

  it("🔑 the renderer resolves a stored path, so no caller has to", () => {
    /**
     * ⛔ The reason the resolution lives in ONE place. Four callers each
     * downloading from the bucket is four chances to forget, and the one that
     * forgets produces a card that is wrong only in production.
     */
    const r = read("src/lib/social/renderPicture.ts");
    expect(r).toMatch(/getIllustration\(/);
    expect(r, "a fetched background is not inlined as a data URL").toMatch(/data:image\/jpeg;base64,/);
  });

  it("⛔ a background that cannot be fetched does not fail the card", () => {
    // 🔴 A missing post is worse than a plain one. Null must compose today's
    // card, not throw.
    const r = read("src/lib/social/renderPicture.ts");
    expect(r).toMatch(/if \(src\) illustration = \{/);
  });

  it("⚠️ the queue gives a picture only AFTER the post is saved", () => {
    /**
     * 🔴 THE ORDERING THAT KEEPS A DRAWING FROM COSTING A SLOT. Four Instagram
     * slots went empty this month; a model outage must not be able to do that
     * again for the sake of a nicer picture.
     */
    const q = read("src/app/api/cron/social-queue/route.ts");
    const saved = q.indexOf("savePreparedPost(");
    const given = q.indexOf("giveAPicture(");
    expect(saved, "nothing saves the post").toBeGreaterThan(-1);
    expect(given, "nothing gives it a picture").toBeGreaterThan(-1);
    expect(given, "the picture is drawn before the post is safe").toBeGreaterThan(saved);
  });

  it("⛔ and a failed drawing is caught, never thrown", () => {
    const q = read("src/app/api/cron/social-queue/route.ts");
    const given = q.indexOf("giveAPicture(");
    const after = q.slice(given, given + 1200);
    expect(after, "a drawing failure would take the whole run down").toMatch(/catch/);
  });
});
