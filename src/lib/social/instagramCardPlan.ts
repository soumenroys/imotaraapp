// src/lib/social/instagramCardPlan.ts
// Which cards an Instagram post publishes, and whether it may publish at all.
//
// 🔴 WHY THIS IS NOT IN THE CRON ROUTE, where it was first written. A Next.js
// route handler cannot be called from a test without a request, a database and
// a live Graph — so every rule inside one ends up "tested" by reading the
// route's own source text for a string. Those tests pass on dead code, pass on
// a rule moved after an early return, and passed on a fix I appended after a
// `return` ⇒ trap_code_after_an_early_return_is_dead_code.
//
// ⛔ So the DECISION lives here, where it is a function with inputs and an
// answer, and the route does the irreversible part. The three refusals below
// are the three ways a carousel publishes as something nobody approved.

import { cardUrlFor, cardsForPost, publicOrigin } from "./cardUrl";

export type InstagramCardPlan =
  /** ⚠️ `urls.length === 1` is a single picture; more is a carousel. */
  | { ok: true; urls: string[] }
  | { ok: false; why: string; hint: string };

/**
 * What this post would publish on Instagram, or why it would not.
 *
 * 🔑 THE ORDER IS cardsForPost's ORDER — subject first, then the slides — and
 * that is the same function the renderer and the admin preview use. Three
 * implementations of "which card is which" is how a carousel publishes
 * shuffled while every card is individually fine.
 */
export function instagramCardPlan(
  post: {
    id: string;
    subject?: string | null;
    slides?: string[] | null;
    media_kind?: string | null;
  },
  origin: string = publicOrigin(),
): InstagramCardPlan {
  /**
   * 🔴 THERE IS NO TEXT-ONLY INSTAGRAM POST. Facebook will take words on
   * their own; Instagram will not. A post that arrives here without a card is
   * not a post that goes out as words — it is a post that does not go out.
   */
  if (post.media_kind !== "graphic" && post.media_kind !== "carousel") {
    return {
      ok: false,
      why: "Instagram needs a picture",
      hint:
        "Instagram has no text-only post, and this one has no card. ⛔ Nothing was published. " +
        "▶️ Give it a graphic in the composer.",
    };
  }

  if (post.media_kind === "graphic") {
    // ⚠️ Slide 0 signs and reads exactly as a single card always has, so
    // nothing about the carousel work changes this URL.
    return { ok: true, urls: [cardUrlFor(post.id, origin)] };
  }

  const cards = cardsForPost({ subject: post.subject, slides: post.slides });

  /**
   * ⛔ A CAROUSEL THAT IS ONE CARD IS NOT THE POST THAT WAS APPROVED. It would
   * publish perfectly well as a single image, which is exactly the problem:
   * somebody approved several cards, the slides went missing somewhere, and
   * the timeline would show no sign of it.
   */
  if (cards.length < 2) {
    return {
      ok: false,
      why: "A carousel with fewer than two cards",
      hint:
        `This was approved as a carousel but only ${cards.length} card could be built from it. ` +
        `⛔ Nothing was published — a one-card carousel is a different post from the one approved. ` +
        `▶️ Check the post's slides in the composer.`,
    };
  }

  /**
   * ⛔ AND MORE THAN TEN IS REFUSED HERE RATHER THAN TRUNCATED. Meta's limit
   * is ten; the writer caps slides at nine so that the subject makes ten. If
   * both of those ever drift, this refuses instead of quietly dropping the
   * cards at the end — which would publish a post that stops mid-thought.
   */
  if (cards.length > 10) {
    return {
      ok: false,
      why: "A carousel with more than ten cards",
      hint:
        `Instagram takes at most ten cards and this post has ${cards.length}. ` +
        `⛔ Nothing was published — refused rather than publishing it with the last cards missing.`,
    };
  }

  /**
   * ⚠️ ONLY THE COUNT OF `cards` IS READ HERE — the slide number comes from
   * the index, and the renderer looks the text back up by that number. So
   * reversing `cards` above changes nothing, and a mutation that did exactly
   * that survived the tests, correctly: there is no defect to catch.
   *
   * 🔑 WHAT THIS FUNCTION DOES OWN is that the slide numbers run 0, 1, 2 … in
   * the order the URLs are returned. Publishing them descending, or starting
   * at 1, is the shuffled carousel — every card individually fine — and that
   * is what the tests pin.
   */
  return { ok: true, urls: cards.map((_, i) => cardUrlFor(post.id, origin, i)) };
}
