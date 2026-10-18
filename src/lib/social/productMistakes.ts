// src/lib/social/productMistakes.ts
// The things that actually went wrong, and nothing else.
//
// 🔴 WHY THIS FILE EXISTS, from the first post the angle ever produced.
//
// Asked for "something we got wrong", the model wrote:
//
//   "We started with cloud sync on by default and realised it wasn't right
//    for something private."
//
// ⛔ That never happened. The owner confirmed it on 18 Oct, and nothing in the
// code, the memory files or git history records sync ever being on by default.
// The model had no access to the product's history, was asked for a piece of
// it, and produced a plausible one.
//
// 🔑 THIS IS THE TAMIL WORD AGAIN, IN A WORSE PLACE. A wrong gloss embarrasses
// us with speakers of one language. A false confession is a untrue statement
// about the company, published voluntarily, in the one register where being
// caught costs the most — because the whole value of an admission is that it
// is true ⇒ src/lib/social/untranslatableWords.ts.
//
// ⚠️ AND THE CHECK HERE IS WEAKER THAN THE WORD CHECK, which has to be said
// out loud. A word either appears in the post or it does not. A mistake can be
// EMBELLISHED — the right subject with an invented detail attached — and no
// string match catches that. So this pool carries a second safeguard the word
// pool does not need: its posts can never publish unattended.

export type ProductMistake = {
  id: string;
  /** What was wrong, named without softening. */
  what: string;
  /** What it was changed to. */
  fix: string;
  /**
   * Words the post must contain, so it can be checked that it is about THIS
   * mistake and not a different, invented one.
   *
   * ⚠️ This catches a post that wandered off. ⛔ It does NOT catch a post that
   * stays on subject and adds something untrue — nothing automatic does.
   */
  keywords: string[];
  /** ⛔ `null` means NOT USABLE. */
  confirmedBy: string | null;
  confirmedAt: string | null;
  /** Where somebody can check it actually happened. */
  evidence?: string;
  note?: string;
};

/**
 * ⚠️ SEEDED EMPTY OF CONFIRMATIONS, so the angle ships switched off.
 *
 * 🔑 ONLY THE OWNER CAN FILL THIS. I cannot: the product's history is not
 * something I have access to, and producing a plausible version of it is
 * precisely the failure above. The one candidate below is here because it is
 * checkable in git, not because I know it is worth posting.
 *
 * ▶️ To add one: write what went wrong without softening it, write what it was
 * changed to, list the words a post about it must contain, and sign it.
 */
export const PRODUCT_MISTAKES: ProductMistake[] = [
  {
    id: "saved-is-not-working",
    what:
      "we built the part of this that connects a social account, and it reported a channel as " +
      "connected when all it had done was save the token. Nothing had ever asked the platform " +
      "whether the token worked",
    fix:
      "it now asks, and says 'not checked yet' until it has an answer",
    keywords: ["token", "connected", "checked"],
    confirmedBy: null,
    confirmedAt: null,
    evidence: "commit 4884a46, 18 Oct 2026 — 'a saved token was never asked whether it works'",
    note:
      "⚠️ TRUE AND CHECKABLE, but that is not the same as worth posting: it is about our own " +
      "plumbing rather than about anything a reader uses. ⛔ Decline it if it reads as inside " +
      "baseball — an admission nobody cares about is not humility, it is noise.",
  },
];

/** ⛔ Confirmed only. */
export function vettedMistakes(): ProductMistake[] {
  return PRODUCT_MISTAKES.filter((m) => m.confirmedBy !== null);
}

export function mistakesPoolReady(): { ok: boolean; reason?: string } {
  if (vettedMistakes().length > 0) return { ok: true };
  return {
    ok: false,
    reason:
      "No entry in the mistakes table has been confirmed, so the “something we got wrong” angle is " +
      "switched off. ⛔ It is not offered to the writer at all — the first time it ran, it invented " +
      "a history that never happened. ▶️ Add a real one to src/lib/social/productMistakes.ts.",
  };
}

export function pickMistake(seed: number): ProductMistake | null {
  const pool = vettedMistakes();
  if (pool.length === 0) return null;
  return pool[Math.abs(Math.trunc(seed)) % pool.length];
}

/**
 * Is the post about the mistake it was given?
 *
 * ⚠️ EVERY keyword, not any: "token" alone would match half the posts this
 * product writes, and a check that passes easily is a check that is not
 * running.
 */
export function mentionsMistake(text: string, mistake: ProductMistake): boolean {
  const hay = text.toLowerCase();
  return mistake.keywords.every((k) => hay.includes(k.toLowerCase()));
}
