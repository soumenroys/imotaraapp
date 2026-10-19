// src/lib/social/cards.ts
// How many cards a post has, and what each one says.
//
// 🔴 ITS OWN FILE, AND THE REASON IS A RULE THIS CODEBASE HAS LEARNED TWICE.
// It lived in cardUrl.ts, which imports `crypto` — so the admin page could not
// read it and would have kept its own copy of "which card is which". That is
// exactly how contentTypes.ts and topicPools.ts came to exist, and both of
// them record a feature that shipped broken because one copy of a list was
// missed. ⇒ A function with no dependencies belongs where anything can read it.

/**
 * 🔑 HOW MANY CARDS A POST HAS, AND WHAT EACH ONE SAYS.
 *
 * The subject is card 0 — the frame — and the slides follow it. ⛔ Said here,
 * once, because the renderer, the publisher and the admin preview must all
 * agree about the order; three implementations of "which card is which" is
 * how a carousel publishes its slides shuffled, with every individual card
 * perfectly fine and nobody able to say what is wrong.
 */
export function cardsForPost(post: { subject?: string | null; slides?: string[] | null }): string[] {
  const subject = (post.subject ?? "").trim();
  const slides = (post.slides ?? []).map((s) => s.trim()).filter(Boolean);
  if (slides.length === 0) return subject ? [subject] : [];
  return [subject, ...slides].filter(Boolean);
}

/**
 * 🔑 WHICH POSTS MAY BE FETCHED, and the reason the list is short.
 *
 * A signed URL is only as careful as the thing it unlocks. These three are
 * the states in which the words have been approved for publication:
 * `approved` is waiting to go out, `publishing` is the state the row is in at
 * the exact moment Instagram comes to collect the image, and `published` is
 * already public.
 *
 * ⛔ `draft` and `needs_review` are deliberately absent. Those are words a
 * person has not signed off — including, by design, every confession post
 * ⇒ productMistakes.ts — and a signed link to one could be forwarded.
 */
