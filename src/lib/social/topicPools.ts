// src/lib/social/topicPools.ts
// What a post can be about — the one list, in a module a browser can import.
//
// 🔴 THIS WAS THE CONTENT-TYPE BUG AGAIN, AND IT WAS ALREADY THERE.
// `subjects.ts` imports `crypto`, so the schedule form could not read the
// pools from it and kept its own hand-written copy. The comment directly above
// that copy explains why the SHAPES list beside it is derived — "a shape
// nobody can pick cannot happen again" — and then the pools below it were
// hand-written anyway. ⇒ src/lib/social/contentTypes.ts, same cause, same fix:
// a list with no dependencies belongs where anything can read it.
//
// ⚠️ `angle` is only ever read on the server, but it costs a browser nothing —
// it is a few hundred characters of text with no imports behind it, and the
// alternative is two files that drift.

import type { ContentType } from "@/lib/social/contentTypes";

export type TopicPool = {
  id: string;
  label: string;
  /** The angle handed to the writer. Not a subject — a direction to find one in. */
  angle: string;
  /**
   * 🔴 THE SHORT LINE PRINTED ABOVE THE HEADLINE, and the reason it is data
   * here rather than a constant in the renderer.
   *
   * ⛔ IT USED TO BE THE STRING "22 languages", on whatever the post was
   * about. A third of single cards — every `stacked-label` layout and every
   * `caps-label` treatment — carried a brand claim above a sentence about
   * restlessness or about a message typed and deleted. The carousel half of
   * this was fixed on 19 Oct by making the eyebrow a counter; the single-card
   * half survived, because a counter is meaningless on a card of one.
   *
   * ⚠️ NOT `label`. That is written for the admin picking a pool — "The ways
   * one feeling actually shows up (carousel)" — and names the pool. This is
   * written to be READ BY A STRANGER above a sentence, and names the subject.
   *
   * 🔑 ENGLISH, AND DRAWN ONLY ON ENGLISH CARDS ⇒ eyebrowFor. Printing it on
   * a Spanish or Bengali card would be the same defect in a new costume: the
   * wrong words, confidently set. The 21 other languages need a speaker, not
   * a translation written here ⇒ feedback_check_a_dictionary_before_writing.
   */
  eyebrow: string;
  /**
   * 🔴 A BRIEF THAT REPLACES THE SCHEDULE'S, for an angle the schedule's brief
   * actively fights.
   *
   * ⛔ MEASURED, and the measurement is why this field exists. Four previews
   * per combination:
   *
   *     ways-of-saying @ the live brief   → 3/3 product-shaped, NO list
   *     ways-of-saying @ a neutral brief  → 2/2 genuine five-item lists
   *
   * ⚠️ The live brief asks for "one capability of Imotara and what it is
   * for". Most pools are supposed to answer that. A list of five ways a
   * feeling shows up cannot, and loses — every time, not sometimes. ⇒ The
   * pool that needs a different instruction CARRIES it, rather than needing
   * a whole schedule of its own.
   *
   * 🔑 THE ALTERNATIVE WAS A SECOND INSTAGRAM SCHEDULE, which would have
   * meant two posts a day on a channel meant to post once.
   */
  brief?: string;
  /**
   * 🔑 THE SHAPE THIS ANGLE MUST TAKE, when the form IS the point.
   *
   * ⛔ Overrides the schedule's content mix. A list of five recognitions is a
   * carousel or it is nothing: as a single card it is six lines of small type,
   * and as a video it is a slideshow nobody can swipe back through.
   *
   * ⚠️ A pool whose shape a channel cannot publish is DROPPED for that
   * channel ⇒ usablePools, rather than quietly posted in the wrong form.
   */
  shape?: ContentType;
  /**
   * 🔴 TITLE SHAPES, ROTATED IN CODE, for an angle whose titles all come out
   * the same. 29 Oct 2026: 5 of the last 14 Instagram posts were this angle,
   * every one "How <feeling> shows up / feels in a day" — so the subject check
   * (rightly) refused the next one three times a night: "75% of the meaningful
   * words are shared". The feeling changed; the frame never did.
   * ⇒ The frame is chosen here, by turn, not left to the model, which always
   * reaches for the safe one ⇒ trap_a_menu_handed_to_a_model_is_not_a_rotation.
   * `{feeling}` is where the feeling goes.
   */
  titleForms?: string[];
};

/**
 * The pools a schedule can draw from.
 *
 * 🔑 Every one of these is something the product actually does, actually
 * refuses to do, or actually knows. ⛔ There is still no "tips and
 * inspiration" pool, because that is where a brand with nothing to say ends
 * up, and it is also where the claims creep back in.
 *
 * ⚠️ THE 18 OCT ADDITIONS exist because the first seven are all explanations
 * of a product, and product explanation does not travel. A page nobody follows
 * yet is not discovered by explaining its features more clearly; it is
 * discovered because somebody found one post worth sending to one other
 * person. The three new pools are the ones that can do that WITHOUT making a
 * claim — they are about language, about ordinary life, and about us being
 * wrong, none of which needs a statistic or a testimonial to be true.
 */
export const TOPIC_POOLS: TopicPool[] = [
  /**
   * 🔑 THE FIRST POOL SHAPED FOR A CAROUSEL, added 19 Oct.
   *
   * ⚠️ WHY A NEW POOL AND NOT A NEW FORMAT FOR THE OLD ONES. Our posts run two
   * or three sentences. Split across slides that is padding — a sentence per
   * card, the "swipe for the obvious conclusion" shape readers recognise and
   * resent. A carousel has to EARN the swipe, which means each slide has to be
   * worth arriving at. That is a different kind of writing, not a different
   * wrapper.
   *
   * 🔴 THE OBVIOUS IDEA IS BLOCKED. One feeling named in five languages, one
   * per slide, would be uniquely this product's — and the renderer cannot draw
   * those scripts ⇒ trap_a_card_cannot_draw_an_indic_script. ⛔ Do not design
   * for it until a shaping-capable renderer exists.
   *
   * ⛔ AND THE LINE THIS POOL IS CLOSEST TO CROSSING: a list is one step from
   * listicle advice. Nobody here is being taught anything. Each item is a
   * recognition — "that is me" — never a tip, never a step, never a "try
   * this". The moment it instructs, it is the wrong post.
   */
  {
    id: "ways-of-saying",
    label: "The ways one feeling actually shows up (carousel)",
    eyebrow: "How it shows up",
    /**
     * ⛔ NO MENTION OF THE PRODUCT, AND NO ASK FOR A CAPABILITY. That is the
     * entire difference between the 3/3 failure and the 2/2 success above.
     */
    brief:
      "Notice one ordinary feeling and the small, specific ways it actually shows up in a day — " +
      "the things somebody really says out loud, or really does. " +
      "⛔ This post is not about any product, and does not mention one. Nobody is being taught " +
      "anything; they are being recognised, which is the only reason a person saves a post like " +
      "this or sends it to someone. " +
      "⚠️ Write it so that the person it describes feels seen, not diagnosed.",
    shape: "carousel",
    titleForms: [
      "Five quiet signs of {feeling}",
      "What {feeling} sounds like out loud",
      "{feeling}, in everyday words",
      "The small things {feeling} makes us do",
      "When {feeling} doesn't use its own name",
      "Things people say when they mean {feeling}",
      "The everyday disguises of {feeling}",
    ],
    angle:
      "FOUR OR FIVE ways one ordinary feeling actually shows up — each one a phrase somebody really says " +
      "out loud, or a small thing they really do. Name the feeling plainly in the first slide, then let " +
      "each item stand completely on its own. " +
      "⛔ THIS POST IS NOT ABOUT THE PRODUCT. Do not name it, do not end on it, do not turn towards it. " +
      /**
       * 🔴 THE FIRST THREE DRAFTS THIS ANGLE PRODUCED WERE PRODUCT BLURBS.
       * Given only this pool it still wrote "Imotara understands Hindi,
       * Bengali, Tamil…" — an entirely different angle's subject.
       *
       * 🔴 MEASURED, after I got this wrong TWICE in opposite directions.
       * Four previews per combination, not one:
       *
       *   the-unsaid     @ the live brief → 2/2 good moment posts
       *   ways-of-saying @ the live brief → 3/3 product-shaped, NO list
       *   ways-of-saying @ a neutral brief → 2/2 genuine five-item lists
       *
       * ⚠️ So this guard is necessary and NOT sufficient. It stops the
       * product being NAMED; it does not stop the live brief — "take one
       * capability of Imotara and say what it is for" — from overriding the
       * SHAPE. A moment can illustrate a capability, which is why
       * `the-unsaid` survives that brief. A list of five ways a feeling
       * shows up cannot, and loses.
       *
       * ▶️ THIS POOL NEEDS ITS OWN SCHEDULE, with a brief that does not ask
       * for a capability ⇒ social_platform_rules_reviewed_2026_10_19.
       * ⛔ Do not "fix" it by rewriting the shared brief: the product pools
       * (privacy, voice, offline, languages) are supposed to answer it.
       */
      "⛔ NOT ADVICE. No steps, no 'how to', no 'try this', no fixing. Nobody is being taught anything — " +
      "they are being recognised, which is the only reason anyone saves a post like this. " +
      "⚠️ Each item is SHORT: a phrase, or one sentence. If an item needs explaining it is the wrong item. " +
      "🔑 The last one is the quietest and the most true — that is the slide somebody screenshots. " +
      "⛔ No number in the first slide if the count might change; say the feeling, not the arithmetic.",
  },

  {
    id: "languages",
    label: "The 22 languages",
    eyebrow: "22 languages",
    angle:
      "One language the product speaks, and what it means to think in it rather than translate into English. " +
      "Name the language. Say something true about speaking it that a speaker would recognise.",
  },
  {
    id: "privacy",
    label: "Privacy, and what stays on the device",
    eyebrow: "Where words go",
    angle:
      "One specific thing about where a person's words go, or do not go. Concrete, checkable, no reassurance " +
      "that is not backed by a setting or a policy line somebody could read.",
  },
  {
    id: "voice",
    label: "Talking rather than typing",
    eyebrow: "Said aloud",
    angle: "Why saying a thing out loud is different from writing it, and what the product does about that.",
  },
  {
    id: "offline",
    label: "Working without signal",
    eyebrow: "Without signal",
    angle: "One thing that still works with no connection, and why that was worth building.",
  },
  {
    id: "limits",
    label: "What it is not",
    eyebrow: "What it is not",
    angle:
      "Something the product deliberately does not do, and the reason. ⛔ Not framed as modesty or as a " +
      "humblebrag — as information a person deciding whether to use it would want.",
  },
  {
    id: "organisations",
    label: "For organisations",
    eyebrow: "For organisations",
    angle:
      "How a team or an NGO uses it, stated plainly. ⛔ Never addressed to a job title — see the audience " +
      "rule; say the thing so that anybody reading it understands what it is.",
  },
  {
    id: "quiet-hours",
    label: "The hours nobody staffs",
    eyebrow: "The quiet hours",
    angle: "Being available at a time when nothing else is, without dramatising it.",
  },

  // ───────────────────────────────────────────────────────────────────────────
  // Added 18 Oct. These are the ones somebody might actually send to a friend.
  // ───────────────────────────────────────────────────────────────────────────
  {
    id: "untranslatable",
    label: "A feeling English has no word for",
    eyebrow: "No English word",
    angle:
      "ONE word from one of the languages this product speaks, naming a feeling — or a kind of closeness " +
      "between people — that English needs a whole sentence for. Give the word, the language, and what it " +
      "actually means — plainly, the way a speaker would explain it to a friend, not the way a dictionary " +
      "would. " +
      "⛔ THE WORD IS CHOSEN FOR YOU AND HANDED TO YOU WITH ITS MEANING. You may not pick your own: the " +
      "first time this angle ran it invented a gloss for a Tamil word and was wrong " +
      "⇒ src/lib/social/untranslatableWords.ts. " +
      /**
       * 🔴 THIS USED TO SAY "⛔ ONLY a word you are certain of. If you are not
       * sure the word means what you are about to say, CHOOSE A DIFFERENT
       * POST." That was correct while the model picked its own word.
       *
       * ⛔ The moment the word started being HANDED to it, the same sentence
       * became an explicit licence to abandon the angle — and the first post
       * written under the new design took it: given অভিমান, it wrote about
       * talking versus typing instead. An instruction that is right under one
       * design and wrong under the next reads perfectly reasonable in
       * isolation, which is exactly why it survived the change.
       */
      "⛔ The word you are given is the only one you may use, and the meaning you are given is the " +
      "only meaning you may give it. You are not being asked to judge whether it is right — somebody " +
      "who speaks the language already did that. Do not substitute another word, and do not fall back " +
      "to a different subject: on this angle there is no different subject available. " +
      "⛔ Do not explain why this matters for mental health, and do not mention the product at all " +
      "unless it genuinely belongs. The word is the post.",
  },
  {
    // 🔑 Added 24 Oct (owner: content driven by "latest trends … aligned with
    // imotara interest"). ⛔ Only offered when a vetted trend is handed over
    // ⇒ lib/social/trends.ts; the writer never picks one.
    id: "trending",
    label: "What people are talking about this week",
    eyebrow: "This week",
    angle:
      "This week's moment — HANDED TO YOU below, with why it matters and Imotara's angle on it. Connect " +
      "the moment to that ONE true thing, warmly and plainly. ⛔ Add no facts about the event itself.",
  },
  {
    id: "the-unsaid",
    label: "The thing nobody said",
    eyebrow: "Left unsaid",
    angle:
      "One ordinary, specific, recognisable moment of not saying something — the 'I'm fine' at the door, " +
      "the message typed and deleted, the answer given because it was shorter. Describe the moment and " +
      "stop. " +
      "⛔ No lesson, no advice, no 'and that's okay', and no turn towards the product at the end. The " +
      "recognition IS the post; adding a moral to it is what makes a true thing read as an advertisement.",
  },
  {
    id: "built-wrong",
    label: "Something we got wrong",
    eyebrow: "We got this wrong",
    angle:
      "A real decision in building this that turned out to be wrong, and what it was changed to. Name the " +
      "wrong thing first and without softening it. " +
      "🔑 This is the most trustworthy thing a product can say and almost nobody says it. " +
      "⛔ Not a humblebrag wearing a confession's clothes ('we cared too much about privacy'). If it does " +
      "not cost anything to admit, it is not this pool.",
  },
];

export const TOPIC_POOL_IDS = TOPIC_POOLS.map((p) => p.id);

/**
 * The eyebrow a post's card may print, or null if it may not print one.
 *
 * ⛔ NULL IS THE NORMAL ANSWER, in three cases, and each is a refusal rather
 * than a gap:
 *
 *   • no pool — posts written before 18 Oct have no `topic_pool`, and a post
 *     whose subject is unrecorded has nothing true to say above its headline.
 *   • an unknown pool — a pool id that has since been renamed or removed. ⚠️
 *     The same trap as a stored layout name ⇒ RETIRED_LAYOUTS: a value that is
 *     persisted and later matched by name is a public identifier. Here the
 *     honest answer is to draw no eyebrow, never to guess at one.
 *   • any language but English — the eyebrows above are English prose.
 *
 * 🔑 CENTRAL ON PURPOSE. Six paths render a card for the same post, and they
 * must agree: a stored card and an on-demand card that disagree is a defect
 * this codebase has already had once ⇒ the support-line comment in pipeline.
 */
export function eyebrowFor(topicPool: string | null | undefined, language: string): string | null {
  if (language !== "en") return null;
  if (!topicPool) return null;
  return TOPIC_POOLS.find((p) => p.id === topicPool)?.eyebrow ?? null;
}
