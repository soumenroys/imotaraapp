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

export type TopicPool = {
  id: string;
  label: string;
  /** The angle handed to the writer. Not a subject — a direction to find one in. */
  angle: string;
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
  {
    id: "languages",
    label: "The 22 languages",
    angle:
      "One language the product speaks, and what it means to think in it rather than translate into English. " +
      "Name the language. Say something true about speaking it that a speaker would recognise.",
  },
  {
    id: "privacy",
    label: "Privacy, and what stays on the device",
    angle:
      "One specific thing about where a person's words go, or do not go. Concrete, checkable, no reassurance " +
      "that is not backed by a setting or a policy line somebody could read.",
  },
  {
    id: "voice",
    label: "Talking rather than typing",
    angle: "Why saying a thing out loud is different from writing it, and what the product does about that.",
  },
  {
    id: "offline",
    label: "Working without signal",
    angle: "One thing that still works with no connection, and why that was worth building.",
  },
  {
    id: "limits",
    label: "What it is not",
    angle:
      "Something the product deliberately does not do, and the reason. ⛔ Not framed as modesty or as a " +
      "humblebrag — as information a person deciding whether to use it would want.",
  },
  {
    id: "organisations",
    label: "For organisations",
    angle:
      "How a team or an NGO uses it, stated plainly. ⛔ Never addressed to a job title — see the audience " +
      "rule; say the thing so that anybody reading it understands what it is.",
  },
  {
    id: "quiet-hours",
    label: "The hours nobody staffs",
    angle: "Being available at a time when nothing else is, without dramatising it.",
  },

  // ───────────────────────────────────────────────────────────────────────────
  // Added 18 Oct. These are the ones somebody might actually send to a friend.
  // ───────────────────────────────────────────────────────────────────────────
  {
    id: "untranslatable",
    label: "A feeling English has no word for",
    angle:
      "ONE word from one of the languages this product speaks, naming a feeling — or a kind of closeness " +
      "between people — that English needs a whole sentence for. Give the word, the language, and what it " +
      "actually means — plainly, the way a speaker would explain it to a friend, not the way a dictionary " +
      "would. " +
      "⛔ THE WORD IS CHOSEN FOR YOU AND HANDED TO YOU WITH ITS MEANING. You may not pick your own: the " +
      "first time this angle ran it invented a gloss for a Tamil word and was wrong " +
      "⇒ src/lib/social/untranslatableWords.ts. " +
      "⛔ ONLY a word you are certain of. If you are not sure the word means what you are about to say, " +
      "choose a different post: a mistranslation here insults the people whose language it is, and they " +
      "are exactly the readers this is for. ⛔ Do not explain why this matters for mental health, and do " +
      "not mention the product at all unless it genuinely belongs. The word is the post.",
  },
  {
    id: "the-unsaid",
    label: "The thing nobody said",
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
    angle:
      "A real decision in building this that turned out to be wrong, and what it was changed to. Name the " +
      "wrong thing first and without softening it. " +
      "🔑 This is the most trustworthy thing a product can say and almost nobody says it. " +
      "⛔ Not a humblebrag wearing a confession's clothes ('we cared too much about privacy'). If it does " +
      "not cost anything to admit, it is not this pool.",
  },
];

export const TOPIC_POOL_IDS = TOPIC_POOLS.map((p) => p.id);
