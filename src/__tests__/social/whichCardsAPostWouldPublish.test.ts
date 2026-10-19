/**
 * 🔴 THE DECISION THAT USED TO BE UNTESTABLE.
 *
 * "How many cards does this post publish, and may it publish at all?" lived
 * inside the cron route, where a test can only read the route's source and
 * look for a string. Those tests pass on dead code, pass on a rule that moved
 * after an early return, and passed on a fix I appended AFTER a `return`
 * ⇒ trap_code_after_an_early_return_is_dead_code.
 *
 * ⛔ So this file calls the function and reads the answer. Every assertion
 * below would fail if the rule were deleted, reordered, or unreachable.
 */

import { describe, it, expect } from "vitest";
process.env.SOCIAL_TOKEN_KEY ??= Buffer.alloc(32, 9).toString("base64");

import { instagramCardPlan } from "@/lib/social/instagramCardPlan";
import { cardUrlFor } from "@/lib/social/cardUrl";
import { CAROUSEL_MAX } from "@/lib/social/adapters/instagram";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ID = "b1b9f1f6-0000-4000-8000-000000000001";
const ORIGIN = "https://www.imotara.com";

const plan = (post: Parameters<typeof instagramCardPlan>[0]) => instagramCardPlan(post, ORIGIN);

describe("a post with no card at all", () => {
  it("⛔ is refused, because Instagram has no text-only post", () => {
    for (const kind of ["none", "text", null, undefined, "short_video"]) {
      const out = plan({ id: ID, subject: "S", media_kind: kind as string | null });
      expect(out.ok, `media_kind ${String(kind)} should not publish`).toBe(false);
      if (out.ok) throw new Error("unreachable");
      expect(out.hint).toMatch(/no text-only post/i);
    }
  });
});

describe("a single-card post", () => {
  it("publishes exactly the URL it always has", () => {
    /**
     * ⚠️ THE REGRESSION THIS GUARDS. Every link already issued for a
     * single-card post keeps working, and there is no stray `s=0` on the
     * normal case — the carousel work must be invisible to a `graphic` post.
     */
    const out = plan({ id: ID, subject: "S", media_kind: "graphic" });
    expect(out.ok).toBe(true);
    if (!out.ok) throw new Error("unreachable");
    expect(out.urls).toEqual([cardUrlFor(ID, ORIGIN)]);
    expect(out.urls[0]).not.toContain("s=0");
  });

  it("ignores slides that a graphic post happens to carry", () => {
    // 🔑 `media_kind` decides, not the presence of data. A post switched from
    // carousel back to graphic in the composer would otherwise publish the
    // slides nobody re-approved.
    const out = plan({ id: ID, subject: "S", slides: ["One.", "Two."], media_kind: "graphic" });
    expect(out.ok).toBe(true);
    if (!out.ok) throw new Error("unreachable");
    expect(out.urls).toHaveLength(1);
  });
});

describe("a carousel", () => {
  it("publishes the subject first and then every slide, in order", () => {
    const out = plan({ id: ID, subject: "S", slides: ["One.", "Two.", "Three."], media_kind: "carousel" });
    expect(out.ok).toBe(true);
    if (!out.ok) throw new Error("unreachable");
    expect(out.urls).toEqual([
      cardUrlFor(ID, ORIGIN, 0),
      cardUrlFor(ID, ORIGIN, 1),
      cardUrlFor(ID, ORIGIN, 2),
      cardUrlFor(ID, ORIGIN, 3),
    ]);
  });

  it("every card carries its own signature, and they all differ", () => {
    /**
     * 🔴 A SINGLE SIGNATURE WOULD AUTHORISE EVERY CARD AT ONCE and let the
     * slide number be edited freely on a URL the renderer trusts. Four
     * identical URLs would also be four identical CARDS — a carousel of the
     * same picture, which is the sort of thing that looks like a render bug
     * and is actually an authorisation bug.
     */
    const out = plan({ id: ID, subject: "S", slides: ["One.", "Two.", "Three."], media_kind: "carousel" });
    if (!out.ok) throw new Error("unreachable");
    expect(new Set(out.urls).size).toBe(out.urls.length);
  });

  it("⛔ refuses a carousel that came out as one card", () => {
    // Somebody approved several cards; the slides went missing somewhere. It
    // would publish fine as a single image, and the timeline would show no
    // sign that anything was lost.
    for (const slides of [null, [], ["   ", ""]]) {
      const out = plan({ id: ID, subject: "S", slides, media_kind: "carousel" });
      expect(out.ok, `slides ${JSON.stringify(slides)} should not publish`).toBe(false);
      if (out.ok) throw new Error("unreachable");
      expect(out.hint).toMatch(/different post from the one approved/i);
    }
  });

  it("⛔ refuses eleven cards rather than dropping the last one", () => {
    /**
     * ⚠️ THE LITERAL ELEVEN. Written as `MAX + 1` this would be a mirror test
     * that moves whenever the constant does — which is exactly how the first
     * version of this rule survived a mutation raising the limit to 99.
     */
    const out = plan({
      id: ID,
      subject: "S",
      slides: Array.from({ length: 10 }, (_, i) => `Slide ${i + 1}.`),
      media_kind: "carousel",
    });
    expect(out.ok).toBe(false);
    if (out.ok) throw new Error("unreachable");
    expect(out.hint).toContain("11");
    expect(out.hint).toMatch(/last cards missing/i);
  });

  it("takes exactly ten", () => {
    // ⚠️ The boundary in the other direction: nine slides plus the subject is
    // the most a post can be, and it must not be refused.
    const out = plan({
      id: ID,
      subject: "S",
      slides: Array.from({ length: 9 }, (_, i) => `Slide ${i + 1}.`),
      media_kind: "carousel",
    });
    expect(out.ok).toBe(true);
    if (!out.ok) throw new Error("unreachable");
    expect(out.urls).toHaveLength(10);
  });

  it("⛔ returns the slide numbers in ascending order from zero", () => {
    /**
     * 🔴 THE PROPERTY THIS MODULE ACTUALLY OWNS. The renderer looks each
     * card's text back up BY SLIDE NUMBER, so descending numbers — or numbers
     * starting at 1 — publish a shuffled carousel in which every individual
     * card is perfectly fine and nobody can say what is wrong.
     *
     * ⚠️ Reversing the card TEXTS in this function is a no-op, because only
     * the count is read. Measured: that mutation survived, and should.
     */
    const out = plan({ id: ID, subject: "S", slides: ["One.", "Two.", "Three."], media_kind: "carousel" });
    if (!out.ok) throw new Error("unreachable");
    expect(out.urls[0]).not.toContain("&s=");
    expect(out.urls.slice(1).map((u) => new URL(u).searchParams.get("s"))).toEqual(["1", "2", "3"]);
  });

  it("drops a blank slide rather than publishing an empty card", () => {
    // 🔴 A card rendered from "" is a BLANK CARD in the middle of a public
    // carousel — visible to everyone, explicable by nobody.
    const out = plan({ id: ID, subject: "S", slides: ["One.", "  ", "Two."], media_kind: "carousel" });
    expect(out.ok).toBe(true);
    if (!out.ok) throw new Error("unreachable");
    expect(out.urls).toHaveLength(3);
  });
});

/**
 * 🔴 THE SAME LIMIT, WRITTEN IN THREE PLACES, FOR THREE DIFFERENT REASONS.
 *
 *   · the writer caps slides at 9 — what a model may invent
 *   · this plan refuses more than 10 cards — what we will assemble
 *   · the adapter refuses more than 10 — what Meta will accept
 *
 * ⛔ They are NOT derived from each other on purpose: the writer's cap is a
 * judgement, Meta's is documentation, and deriving one from the other hides a
 * drift rather than preventing it. ⇒ So they are pinned together HERE, in one
 * assertion whose failure says which one moved.
 */
describe("the three places ten is written down", () => {
  it("agree: 9 slides + the subject = 10 cards = Meta's limit", () => {
    expect(CAROUSEL_MAX).toBe(10);

    // The writer's cap, read from its source — the one copy that is a literal
    // inside a parse and cannot be imported.
    const writer = readFileSync(join(process.cwd(), "src/lib/social/writer.ts"), "utf8");
    expect(writer).toMatch(/\.slice\(0,\s*9\)/);

    // And the plan's own ceiling, proved by calling it rather than read.
    const ten = plan({
      id: ID,
      subject: "S",
      slides: Array.from({ length: 9 }, (_, i) => `S${i}.`),
      media_kind: "carousel",
    });
    expect(ten.ok).toBe(true);
  });
});
