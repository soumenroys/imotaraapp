/**
 * 🔴 TWO RENDERERS DRAWING ONE TREE, AND WHY THERE HAD TO BE TWO.
 *
 * Satori does NO complex-script shaping. অভিমান drew as অভমিান on a live
 * Instagram post the owner deleted, and 12 of 13 scripts are still
 * `shapingVerified: false` ⇒ fonts.ts. That blocks 21 of the 22 languages
 * from Instagram entirely, because Instagram has no text-only post.
 *
 * ⛔ I MEASURED THE ALTERNATIVES RATHER THAN REASONING ABOUT THEM, because
 * this had already been guessed at twice. The same strings, three renderers:
 *
 *     satori    ✗  the vowel sign before the wrong consonant
 *     resvg-js  ✗  marks misplaced, glyphs overlapping
 *     Chromium  ✓  every script correct, including Bengali's pre-base ি
 *
 * ⚠️ So this is a SECOND renderer, not a replacement. Latin keeps going
 * through Satori — fast, no binary, and every card published so far came out
 * of it. Two renderers that both drew everything would drift.
 *
 * 🔑 WHICH MAKES THE RULE BELOW THE IMPORTANT ONE: both must lay the same
 * tree out the same way, or the card a reviewer approves is not the card that
 * publishes.
 */

import { describe, it, expect } from "vitest";
import { nodeToHtml, cardHtml, SCRIPT_FONT_STACK } from "@/lib/social/toHtml";
import type { Node } from "@/lib/social/compose";

const node = (over: Partial<Node> = {}): Node =>
  ({ tag: "div", style: { display: "flex" }, ...over }) as Node;

describe("the tree becomes HTML the browser lays out identically", () => {
  it("camelCase styles become CSS properties", () => {
    const html = nodeToHtml(node({ style: { fontSize: 42, backgroundColor: "#111" } }));
    expect(html).toContain("font-size:42px");
    expect(html).toContain("background-color:#111");
  });

  it("⛔ a bare number is px — EXCEPT where px would be meaningless", () => {
    /**
     * 🔴 `flex: 1` written as `flex: 1px` is not flex at all: the spacer
     * collapses and every bottom-weighted layout slides up the card. ⚠️ Same
     * for lineHeight, where 1.16px would set every line on top of the last.
     */
    const html = nodeToHtml(node({ style: { flex: 1, lineHeight: 1.16, fontWeight: 600, height: 20 } }));
    expect(html).toContain("flex:1;");
    expect(html).toContain("line-height:1.16");
    expect(html).toContain("font-weight:600");
    expect(html).toContain("height:20px");
  });

  it("every div is flex, because the tree was built for Satori's model", () => {
    // ⛔ A browser defaults to block. Without this the same tree lays out
    // differently in the two renderers.
    const page = cardHtml(node(), 1080, 1080, [{ family: "Noto Sans Bengali", dataUri: "data:font/ttf;base64,AAA" }]);
    expect(page).toMatch(/div\s*\{\s*display:\s*flex/);
    expect(page).toContain("width:1080px");
  });

  it("an img is void and carries its src", () => {
    const html = nodeToHtml(node({ tag: "img", src: "https://x.test/a.png" }));
    expect(html).toContain('src="https://x.test/a.png"');
    expect(html).not.toContain("</img>");
  });

  it("⛔ text is escaped, because a headline is somebody's words", () => {
    /**
     * 🔴 A post is model-written text going into a markup document. A subject
     * containing `<` would silently become a tag and the rest of the card
     * would vanish — or worse, not vanish.
     */
    const html = nodeToHtml(node({ text: `5 < 6 & "quoted"` }));
    expect(html).toContain("&lt;");
    expect(html).toContain("&amp;");
    expect(html).not.toMatch(/<(?!\/?div)/);
  });

  it("⛔ an attribute cannot be broken out of either", () => {
    const html = nodeToHtml(node({ tag: "img", src: `a.png" onerror="alert(1)` }));
    expect(html).not.toContain('onerror="alert(1)"');
    expect(html).toContain("&quot;");
  });
});

describe("⛔ the page is handed the font BYTES, never a url", () => {
  /**
   * 🔴 MEASURED IN PRODUCTION. The first Vercel render came back as a perfect
   * card with every Bengali glyph drawn as Chromium's NO GLYPH box: the
   * browser started, the layout was right, and not one face had loaded.
   * "Imotara" looked fine only because Latin had a fallback the container
   * already had — Bengali had none, so it showed the truth.
   *
   * ⛔ A `url()` makes the BROWSER fetch, inside a sandboxed container, from
   * an about:blank origin. Network, DNS, CORS and origin policy all sit in
   * the way, and every one of them fails as tofu rather than as an error.
   */
  it("embeds a data: URI and never a remote url", () => {
    const page = cardHtml(node({ text: "অভিমান" }), 1080, 1080, [
      { family: "Noto Sans Bengali", url: "https://x.test/bn.ttf", dataUri: "data:font/ttf;base64,QUJD" },
    ]);
    expect(page).toContain("src:url(data:font/ttf;base64,QUJD)");
    expect(page).not.toContain("https://x.test/bn.ttf");
  });

  it("⛔ a face with no bytes is DROPPED, not quietly fetched", () => {
    // ⚠️ Silently falling back to the url would reinstate exactly the failure
    // this removes, and hide it again.
    const page = cardHtml(node(), 1080, 1080, [
      { family: "Noto Sans Bengali", url: "https://x.test/bn.ttf" },
    ]);
    expect(page).not.toContain("https://x.test/bn.ttf");
    expect(page).not.toContain("@font-face");
  });
});

describe("the fonts are named, not left to chance", () => {
  it("⛔ never resolves a script through a generic family alone", () => {
    /**
     * ⚠️ `sans-serif` is one thing on a developer's Mac and another on a
     * build server. The difference shows up as a card that looked right in
     * review and wrong in public — which is the failure this whole area keeps
     * producing.
     */
    for (const script of ["Bengali", "Devanagari", "Tamil", "Telugu", "Malayalam", "Gurmukhi"]) {
      expect(SCRIPT_FONT_STACK).toContain(`Noto Sans ${script}`);
    }
    // A generic is present as the LAST resort, never the first.
    expect(SCRIPT_FONT_STACK.endsWith("sans-serif")).toBe(true);
    expect(SCRIPT_FONT_STACK.startsWith("sans-serif")).toBe(false);
  });

  it("families with spaces are quoted, or the stack silently truncates", () => {
    expect(SCRIPT_FONT_STACK).toContain('"Noto Sans Bengali"');
  });
});

/**
 * 🔴 THE BUG THAT TOOK TWO DEPLOYS AND TWO WRONG THEORIES.
 *
 * composePicture sets `fontFamily` on the ROOT node, because Satori has no
 * system default and text in an unnamed family simply does not appear. For a
 * script nobody has verified, the wordmark is substituted to Latin — so that
 * family is "Inter", and an inline style on the root beats anything on
 * `body`. Every glyph on the card was being asked for in Inter. Bengali in
 * Inter is tofu, which is exactly what Vercel returned.
 *
 * ⛔ AND THE LOCAL PREVIEW COULD NOT HAVE CAUGHT IT. A Mac has Noto Sans
 * Bengali installed, so Chromium fell back to the system face and the card
 * looked perfect every time I ran it. The serverless container has no Indic
 * font at all. ⇒ A preview on a machine that owns the fonts cannot answer a
 * question about a machine that does not — which is why the page is now
 * asked directly ⇒ FontProbe.
 */
describe("the root's own font-family cannot override the stack", () => {
  const root = {
    tag: "div",
    // Exactly what composePicture produces: one Latin family, inline.
    style: { display: "flex", fontFamily: "Inter", backgroundColor: "#12291F" },
    children: [{ tag: "div", style: { display: "flex", fontSize: 59 }, text: "অভিমান" }],
  } as unknown as Node;

  const page = cardHtml(root, 1080, 1080, [
    { family: "Inter", dataUri: "data:font/ttf;base64,QQ" },
    { family: "Noto Sans Bengali", dataUri: "data:font/ttf;base64,Qg" },
  ]);

  /**
   * ⚠️ READ THROUGH THE ESCAPING. The family names are inside an HTML
   * attribute, so their quotes arrive as `&quot;` — which is the escaping
   * rule two tests above deliberately enforce. ⛔ Asserting on the raw form
   * would fail on correct output, which is how a good escape gets removed to
   * make a test pass.
   */
  const unescaped = (html: string) => html.replace(/&quot;/g, '"').replace(/&amp;/g, "&");
  const body = unescaped(page.slice(page.indexOf("<body>")));

  it("⛔ the root asks for the whole stack, not just the wordmark's family", () => {
    expect(body).toContain('"Noto Sans Bengali"');
    // And the original single family is still there, first — the wordmark
    // must keep its own face.
    expect(body).toMatch(/font-family:"Inter","Noto Sans Bengali"/);
  });

  it("and the script's face is reachable from the root", () => {
    // 🔴 The failure was not a missing @font-face — both faces registered.
    // It was that nothing on the card ever ASKED for the Bengali one.
    expect(page).toContain('@font-face{font-family:"Noto Sans Bengali"');
    expect(body).toMatch(/font-family:[^;]*Noto Sans Bengali/);
  });

  it("⛔ a generic family is still last, so a missing face looks wrong", () => {
    const family = /font-family:([^;]*)/.exec(body)?.[1] ?? "";
    expect(family.trim().endsWith("sans-serif")).toBe(true);
    expect(family.indexOf("Noto Sans Bengali")).toBeLessThan(family.indexOf("sans-serif"));
  });
});
