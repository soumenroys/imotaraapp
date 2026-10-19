/**
 * 🔴 STORING A CARD BUYS A NEW WAY TO BE WRONG, AND THIS IS IT.
 *
 * Every other card in this system is DERIVED from its recipe at fetch time,
 * deliberately: a palette fix improves every past picture and nothing has to
 * be migrated. The cards a browser draws cannot work that way — Instagram
 * fetches the picture itself, and a Chromium cold start on that request turns
 * a design choice into a publish failure. So those bytes are stored.
 *
 * ⛔ THE MOMENT BYTES ARE STORED, THEY CAN BE STALE. A stored card is a
 * picture of the words as they were. Edit the post, approve it again, and the
 * card route — which PREFERS stored bytes — would serve the old picture under
 * the new approval. The reviewer would have approved one thing and the world
 * would see another, with nothing anywhere saying so.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
process.env.SOCIAL_TOKEN_KEY ??= Buffer.alloc(32, 9).toString("base64");

import { cardPath } from "@/lib/social/cardStore";
import { cardPlan, shapedFaces } from "@/lib/social/needsShaping";
import { SCRIPT_FONTS } from "@/lib/social/fonts";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const admin = strip(read("src/app/api/admin/social/posts/[id]/route.ts"));
const cardRoute = strip(read("src/app/api/social/card/[id]/route.ts"));

describe("a stale card cannot outlive the words it pictures", () => {
  it("⛔ editing a post throws its stored cards away", () => {
    expect(admin).toContain("dropCards(id)");
  });

  it("and does so in the EDIT branch, not somewhere harmless", () => {
    // ⚠️ Pinned by position: the drop must happen where the words change, and
    // before the row is written back.
    const drop = admin.indexOf("dropCards(id)");
    const edit = admin.indexOf('status: "needs_review"');
    expect(drop).toBeGreaterThan(-1);
    expect(edit).toBeGreaterThan(-1);
    expect(drop).toBeLessThan(edit);
  });
});

describe("the card route prefers stored bytes, and must", () => {
  it("⛔ checks storage BEFORE deriving, not after a failure", () => {
    /**
     * 🔴 Satori does not FAIL on a script it cannot shape — it succeeds,
     * wrongly. "Try to derive, fall back to stored" would therefore serve the
     * jumbled card every time, for the one request that cannot be taken back.
     */
    const stored = cardRoute.indexOf("getCard(");
    const derive = cardRoute.indexOf("renderPostPictureJpeg(");
    expect(stored).toBeGreaterThan(-1);
    expect(derive).toBeGreaterThan(-1);
    expect(stored).toBeLessThan(derive);
  });

  it("every slide has its own path, or a carousel is one picture repeated", () => {
    expect(cardPath("p", 0)).not.toBe(cardPath("p", 1));
    expect(cardPath("p", 2)).toContain("p/");
    expect(cardPath("p", 2)).toMatch(/\.jpg$/);
  });
});

describe("approval refuses rather than queueing a post with no card", () => {
  it("⛔ the card is drawn BEFORE the row is marked approved", () => {
    /**
     * 🔴 On Instagram a card is not decoration — there is no text-only post.
     * An approved post with no card is one the publisher holds on every run
     * forever, and the only symptom is a channel going quiet
     * ⇒ trap_a_dead_cron_fails_where_nobody_is_watching.
     */
    const ensure = admin.indexOf("ensureCard(id)");
    const approve = admin.indexOf('status: "approved"');
    expect(ensure).toBeGreaterThan(-1);
    expect(ensure).toBeLessThan(approve);
    // And a failure returns before the update, rather than logging and going on.
    expect(admin.slice(ensure, approve)).toContain("return NextResponse.json");
  });
});

describe("⛔ shaping unlocks the possibility; a READER unlocks the language", () => {
  it("an unverified script is refused even though a browser can draw it", () => {
    /**
     * 🔴 THIS IS THE RULE MOST AT RISK OF BEING QUIETLY DROPPED, now that a
     * renderer exists that shapes correctly. It must not be.
     *
     * Satori rendered অভিমান as অভমিান and looked entirely plausible to
     * everyone here — the only thing that caught it was somebody who reads
     * Bengali seeing a published post. A renderer correct in general can
     * still meet a missing glyph, a conjunct the face lacks, or a line break
     * in the wrong place.
     */
    // ⚠️ bn is NO LONGER in this list: the owner, who reads Bengali, looked
    // at a card rendered in production on 19 Oct and confirmed it. That is
    // the gate working, not the gate being bypassed.
    for (const language of ["hi", "ta", "ml"]) {
      const plan = cardPlan(language);
      expect(plan.how, `${language} must still be held`).toBe("refuse");
      if (plan.how !== "refuse") throw new Error("unreachable");
      expect(plan.why).toMatch(/confirmed a rendered card/i);
    }
  });

  it("⛔ a CONFIRMED script goes to the browser, never back to Satori", () => {
    /**
     * 🔴 THE BUG THIS CAUGHT ON THE DAY BENGALI WAS CONFIRMED. `cardPlan`
     * read one flag and answered "derive" — sending a script Satori cannot
     * draw to Satori. The jumbled card would have published a second time.
     *
     * ⇒ Two questions: `complexScript` picks the renderer, `shapingVerified`
     * permits the shaped one.
     */
    const bn = cardPlan("bn");
    expect(bn.how).toBe("shape");
    if (bn.how !== "shape") throw new Error("unreachable");
    expect(bn.family).toMatch(/Bengali/);

    // ⛔ And English still derives — the shaped path is not for everyone.
    expect(cardPlan("en").how).toBe("derive");
  });

  it("English is derived, because it is the one script proven in public", () => {
    expect(cardPlan("en").how).toBe("derive");
    expect(SCRIPT_FONTS.latin.shapingVerified).toBe(true);
  });

  it("⛔ the gate is the FLAG, not a list of script names", () => {
    // ⚠️ A hard-coded "bengali is fine now" would need finding and changing
    // again for every script; the flag is one edit in fonts.ts per language.
    const plan = read("src/lib/social/needsShaping.ts");
    expect(plan).toContain("font.shapingVerified");
    expect(strip(plan)).not.toMatch(/=== ["']bengali["']/);
  });
});

describe("every card carries Latin, whatever its script", () => {
  it("⛔ because the wordmark and the QR labels are Latin", () => {
    /**
     * 🔴 MEASURED ON VERCEL: exactly one face was missing and "Imotara" was
     * the part that still looked perfect, while every Bengali glyph was a
     * NO GLYPH box. A card whose script loaded but whose brand name did not
     * is the same failure wearing the other mask.
     */
    const faces = shapedFaces("bn");
    expect(faces.map((f) => f.family)).toContain(SCRIPT_FONTS.latin.family);
    expect(faces.map((f) => f.family)).toContain(SCRIPT_FONTS.bengali.family);
    expect(faces).toHaveLength(2);
  });

  it("and Latin is not listed twice for an English card", () => {
    expect(shapedFaces("en")).toHaveLength(1);
  });
});
