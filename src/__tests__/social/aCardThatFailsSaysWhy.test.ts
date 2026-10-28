/**
 * 🔴 A CARD THAT FAILED TO RENDER SAID NOTHING.
 *
 * 28 Oct 2026: a LinkedIn draft showed a bare broken-image icon in the owner's
 * review screen; the same picture rendered in 3–4 s minutes later, and nothing
 * — neither the screen nor the logs — said why the first one failed.
 * ⇒ the review screen asks the route on error and offers "Try again"; the
 * route logs the failure.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

describe("a card that fails to render says why", () => {
  const page = read("src/app/admin/social/page.tsx");

  it("the review screen shows cards through CardPicture, not a bare <img>", () => {
    expect(page).toMatch(/<CardPicture\s/);
    // ⛔ The only <img> left is inside CardPicture, and it reports its failure.
    expect(page.match(/<img\b/g)?.length).toBe(1);
    expect(page).toMatch(/onError=\{\(\) => void explain\(\)\}/);
  });

  it("on failure it shows the route's own reason and a retry", () => {
    expect(page).toMatch(/This picture did not load\./);
    expect(page).toMatch(/Try again/);
  });

  it("the picture route logs a failed render", () => {
    const route = read("src/app/api/admin/social/picture/[id]/route.ts");
    const fail = route.indexOf("if (!rendered.ok) {");
    expect(route.indexOf("console.error(", fail)).toBeGreaterThan(fail);
    expect(route.indexOf("console.error(", fail)).toBeLessThan(route.indexOf("return NextResponse.json", fail));
  });
});
