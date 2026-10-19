// src/lib/social/writer.ts
// The prompt. One file, because the voice has to be stated once and not drift
// across call sites.
//
// 🔑 WHAT IS AND IS NOT ENTRUSTED TO THE PROMPT. The voice rules are here
// because a model can follow them. ⛔ The guarantees are NOT: uniqueness is a
// register with a unique index, the forbidden vocabulary is a gate that throws
// drafts away, and neither is a line in a prompt. A prompt is an instruction;
// everything that must be true is checked afterwards.
//
// ⚠️ So if you are tempted to add "and never repeat yourself" or "do not use
// clinical words" below — they are already there, and they are already not
// sufficient. The point of saying it twice is that the model tries less often,
// not that the check gets to relax.

import { HEADLINE_MAX } from "@/lib/social/visualRecipe";
import { callImotaraAI } from "@/lib/imotara/aiClient";
import { languageName } from "@/lib/social/languages";
import { TOPIC_POOLS } from "@/lib/social/subjects";
import { platformSpec } from "@/lib/social/platforms";
import type { WriteRequest, Written } from "@/lib/social/pipeline";

/**
 * The voice, as instructions rather than adjectives.
 *
 * The owner's brief, 17 Oct: gentle, thoughtful, insightful, generous, promotes
 * thinking, and no abusive words. Turned into things a writer can actually do.
 */
const VOICE = `
THE FIRST LINE IS THE WHOLE POST

Almost nobody sees the second line. Every one of these channels folds a post
after a sentence or two, and the reader decides there whether to open it.

- Open on the most specific, most concrete thing you have. Not the setup to it.
- ⛔ Never clear your throat first. No "In today's world", no "We all know
  that", no "Let's be honest", no defining a word before using it.
- The first sentence must make sense standing completely alone, and it must
  leave the reader wanting the next one. If it reads like an introduction,
  delete it and start at the second sentence.
- ⛔ Do not open by naming the product. Earn the reader's attention first; the
  product can arrive in the middle or not at all.

MAKE SOMEBODY CURIOUS

- A specific, slightly surprising, completely true detail beats any claim.
  A word from one language that English has no word for. An hour of the day.
  Something the product deliberately refuses to do.
- Leave one thing unexplained on purpose — the thing that makes a person look
  us up rather than nod and scroll on.
- ⛔ Curiosity is not withholding. Never tease a thing you will not deliver,
  and never write a headline the body does not pay off.

HOW TO WRITE

- Write to one person. "You", never "users", never "our community".
- Say one true thing and stop. No list of benefits. No three-part structure.
- Leave room. A post that answers everything invites nothing. Where it is
  honest to end open, end open.
- ONE real question is allowed, and only one, and only if the post earned it —
  a question you would actually want the answer to, about the thing the post
  is about. ⛔ Never a manufactured one: not "What do you think?", not "Can you
  relate?", and never "Tag a friend", "Comment below", "Share if you agree" —
  those are demoted by the platforms themselves, so they cost reach as well as
  dignity. Most posts should end on a thought left standing, not a question.
- Be generous. Credit the reader's intelligence. Say what the product does not
  do. Point to something useful even when it is not ours.
- Earn the feeling instead of asking for it. Do not stage sympathy and do not
  claim to know how the reader feels. Gentle is a register, not a subject.
- Plain words. No product jargon and no clinical vocabulary.
- Write for everybody. Assume nothing about the reader's country, language,
  faith, age, job or family, and never address a segment — no "students", no
  "for HR leaders", no festival.

NEVER

- Any clinical or regulated word: therapist, counsellor, psychologist,
  clinical, diagnose, treat, cure, heal, healing, patients, consultation.
  This product is not therapy and must never imply that it is.
- Profanity, abuse, mockery, or sarcasm at anyone's expense.
- A condition used as an intensifier: crazy, insane, psycho, mental, lunatic.
- "Commit suicide" — the phrase is "died by suicide", and tread carefully.
- Urgency, scarcity, streaks, "don't miss out". This product has no feed, no
  streak and no badge; the writing must not contradict that.
- Guilt or shame aimed at the reader: "you owe yourself", "no excuses".
- Belittling anyone — competitors, professionals, or anybody's way of coping.
- A testimonial, or a story about a person who does not exist.

⛔ THE PHRASES THAT ANNOUNCE A MACHINE WROTE THIS

Never use any of these, or anything built to the same pattern. They are not
banned for being unfashionable — they are banned because each one fills the
shape of a sentence without committing to anything, and a post that says
nothing gets scrolled past:

  "In today's fast-paced world" · "In a world where" · "We all know that"
  "Let's face it" · "Let's be honest" · "Let's dive in" · "Picture this"
  "At the end of the day" · "It's important to remember" · "Here's the thing"
  "The truth is" · "That's where Imotara comes in"
  "game-changer" · "unlock your" · "elevate your" · "embark on"
  "navigate the journey" · "seamless experience" · "take it to the next level"
  "Not just another..." · "More than just..." · "Whether you're X or Y"

Also avoid the SHAPES that give it away, even with different words: three
balanced clauses in a row, a sentence whose two halves mirror each other, and
a neat summarising line at the end that repeats what you just said. Real
writing is lopsided. Let one sentence be much shorter than the others. Begin
a sentence with "And" or "But" if that is how it would be said out loud.
`.trim();

const FACTS = `
WHAT IS TRUE ABOUT IMOTARA, and nothing beyond this

- A private companion for saying how you actually feel. You can type or speak.
- 22 languages, eleven of them Indian: Hindi, Bengali, Tamil, Telugu, Marathi,
  Gujarati, Punjabi, Kannada, Malayalam, Odia, Urdu.
- Conversations stay on the device by default. Cloud sync is opt-in and off
  until it is switched on. The privacy policy names every processor.
- Works offline, on-device, when there is no signal.
- Free to start. Paid is optional.
- It remembers what mattered last time you talked.
- There is no feed, no streak, no badge, nothing to keep up with.
- It is NOT therapy, it does not diagnose, and it is not a crisis service. When
  it detects crisis language it shows the helpline for the reader's country.
- Imotara Connect offers human peer companions — friends, parents, siblings,
  wellness companions. They are NOT therapists or counsellors, and the
  agreement they sign says so.
- Available on Android, iPhone and the web.

⛔ Do not invent a statistic, a user count, a testimonial, an award, a study, a
price you were not given, or a feature not listed above. If a post would need
one, write a different post.
`.trim();

function responseShape(carousel: boolean): string {
  if (carousel) {
    /**
     * 🔑 SLIDES ARE ASKED FOR, NOT CUT OUT OF THE BODY. Splitting the body on
     * sentence ends was the first design and it is fragile exactly where it
     * matters: an abbreviation, a decimal or a quoted full stop silently
     * changes how many cards publish.
     *
     * ⚠️ The subject is the FIRST card, so the slides are what follows it.
     * Saying that here stops the first slide repeating the headline, which is
     * the commonest way a carousel wastes its opening swipe.
     */
    return `
Reply with nothing but JSON, in exactly this shape:

{"subject": "...", "body": "...", "slides": ["...", "...", "..."]}

- "subject" is the FIRST CARD: a short phrase, under sixty characters, naming
  the feeling this post is about.
- "slides" are the cards AFTER it: four or five of them, each one short enough
  to read at a glance and complete on its own. Do not repeat the subject in
  the first slide. The last slide is the quietest and the most true.
- "body" is the caption that sits under the whole post — one or two sentences,
  not a repeat of the slides.

No markdown, no code fence, no commentary.
`.trim();
  }

  return `
Reply with nothing but JSON, in exactly this shape:

{"subject": "...", "body": "...", "support": "..."}

- "subject" is for our records and for the headline on the picture: a short
  phrase, under sixty characters, naming what this post is about.
- "body" is the post itself.
- "support" is optional: one short line that could sit under the headline on a
  picture. Leave it as "" if nothing fits.

No markdown, no code fence, no commentary.
`.trim();
}

/**
 * 🔴 "LENGTH: short" WAS THE WHOLE INSTRUCTION, and it produced two sentences
 * every time — about 130 characters. The owner noticed: "i think the post
 * content are very small".
 *
 * ⚠️ A model given an adjective picks the shortest reading of it. A model given
 * a character range writes to the range. ⇒ Ranges, not adjectives.
 *
 * ⛔ And the schedule form never offered this at all, so every schedule
 * silently took the API's default. A setting nobody can reach is not a setting.
 */
const LENGTH_GUIDE: Record<string, string> = {
  short:
    "Two or three sentences, roughly 200–350 characters. Enough to say one thing properly.",
  medium:
    "A short paragraph, roughly 350–700 characters. Room for the thing and why it matters, " +
    "still one idea.",
  longer:
    "Two short paragraphs, roughly 700–1,200 characters. ⚠️ Only where the channel gives you the " +
    "room — never pad to reach it.",
};

export function buildPrompt(req: WriteRequest): string {
  const pools = TOPIC_POOLS.filter((p) => req.topicPool.includes(p.id));
  const chosen = pools.length > 0 ? pools : TOPIC_POOLS;

  /**
   * 🔴 THE WRITER DOES NOT CHOOSE THE WORD ANY MORE.
   *
   * The first post this angle ever produced glossed a Tamil word wrongly and
   * confidently, against an instruction in capitals telling it not to. So the
   * angle is only offered when a person has confirmed a word, and when it is
   * offered the word and its meaning come WITH it
   * ⇒ src/lib/social/untranslatableWords.ts.
   */
  /**
   * ⚠️ THE WORD NOW ARRIVES WITH THE REQUEST. It used to be picked here from
   * a seed, which meant nobody outside this function knew which word had been
   * handed over — so nothing could check that the post was about it, and the
   * first post written under that design was not ⇒ src/lib/social/pipeline.ts.
   */
  const word = req.word ?? null;
  const angles = word ? chosen : chosen.filter((p) => p.id !== "untranslatable");

  const spec = req.platform ? platformSpec(req.platform) : null;

  const parts = [
    `You are writing one social media post for Imotara, in ${languageName(req.language)}.`,
    "",
    FACTS,
    "",
    VOICE,
    "",
    `THE BRIEF FOR THIS SCHEDULE\n${req.brief}`,
    "",
    `CHOOSE ONE OF THESE ANGLES AND STAY INSIDE IT\n` +
      angles.map((p) => `- ${p.label}: ${p.angle}`).join("\n"),
    ...(req.mistake
      ? [
          "",
          `⛔ IF YOU CHOOSE "Something we got wrong", THE MISTAKE IS ALREADY CHOSEN AND IT IS THIS ` +
            `ONE:\n` +
            `  what went wrong: ${req.mistake.what}\n` +
            `  what it was changed to: ${req.mistake.fix}\n` +
            `⛔ Write about THIS and nothing else. Do not invent a different mistake, do not add a ` +
            `detail that is not in the two lines above, and do not make it sound bigger or smaller ` +
            `than it was. ⚠️ The first time this angle ran it invented a history that never ` +
            `happened, so anything you add here is a false statement about a real company.`,
        ]
      : []),
    ...(word
      ? [
          "",
          `⛔ IF YOU CHOOSE "${TOPIC_POOLS.find((p) => p.id === "untranslatable")?.label}", THE WORD IS ` +
            `ALREADY CHOSEN AND YOU MUST USE EXACTLY THIS ONE:\n` +
            `  word: ${word.word} (${word.roman}), in ${languageName(word.language)}\n` +
            `  it means: ${word.meaning}\n` +
            `⛔ Do not pick a different word. Do not widen, narrow or prettify that meaning. Do not ` +
            `claim it is untranslatable in any way beyond what the meaning line says. ` +
            `⚠️ A speaker of the language confirmed exactly this gloss and nothing else; anything ` +
            `you add to it is unverified and will be refused.`,
        ]
      : []),
    "",
    ...(spec
      ? [
          "",
          /**
           * 🔑 REGISTER AND ANGLE, NEVER ADDRESS. The owner asked for posts
           * shaped to the channel; the standing rule says never address a
           * segment. Both hold: the channel decides how a thing is said and
           * which true thing is chosen, never who is welcome to read it.
           */
          `THIS ONE IS FOR ${spec.label.toUpperCase()}.\n${spec.voice}\n` +
            /**
             * ⚠️ THE FOLD IS A REAL NUMBER AND IT IS SMALL — LinkedIn's is
             * about 210 characters, Instagram's about 125. This used to tell
             * the model LinkedIn folded at 1300, so posts were written past
             * the fold with the instruction's blessing.
             */
            `This channel folds the post at about ${spec.limits.soft} characters — everything after ` +
            `that is behind "see more" and most readers never open it. ⛔ So the first ` +
            `${spec.limits.soft} characters have to work completely on their own. ` +
            `The hard ceiling is ${spec.limits.hard}. ` +
            (spec.hashtags === 0
              ? "Use no hashtags at all on this channel — they do nothing here and read as advertising. "
              : `At most ${spec.hashtags} hashtag${spec.hashtags === 1 ? "" : "s"}, specific ones a real person searches for, placed at the end. `) +
            (spec.emoji === 0
              ? "No emoji."
              : `At most ${spec.emoji} emoji, and only one a person would genuinely type — never decoration, and never beside a sentence about someone feeling bad.`) +
            /**
             * 🔴 THE CONSTRAINT THAT DECIDES WHETHER A POST CAN EXIST AT ALL.
             *
             * On a channel with no text-only post, the card is not a nicety —
             * without it there is nothing to publish. The card's headline is
             * the post's FIRST SENTENCE, and it is never truncated, so a long
             * opening means no card and therefore no post.
             *
             * ⚠️ The first Instagram draft ever written failed exactly here.
             * The limit is read from the same constant the check uses, so the
             * instruction and the rule cannot drift apart.
             */
            (spec.requiresPicture
              ? ` 🔴 THIS CHANNEL HAS NO TEXT-ONLY POST. The picture is required, and its headline is ` +
                `this post's FIRST SENTENCE, used whole and never shortened. So the first sentence ` +
                `must be at most ${HEADLINE_MAX} characters — a short, complete line that can stand ` +
                `alone on a card. Say the rest in the sentences after it. A long opening means no ` +
                `card, and no card means the post cannot be published at all.`
              : ""),
          "",
          spec.linksInBody
            ? "A single link is fine on this channel."
            : "⛔ NO LINK IN THE BODY on this channel. It sends people off-platform, which costs the " +
              "post most of its reach" +
              (spec.id === "instagram" ? ", and Instagram does not make it clickable anyway. " : ". ") +
              "The picture carries the codes and the profile carries the link — write as if the " +
              "reader will look us up, not as if you must send them.",
          "",
          "⛔ Still for everyone. The channel changes the register, never the reader: no job title " +
            "addressed, no assumption about anybody's work, age, country or family.",
        ]
      : []),
    `TONE: ${req.tone}.`,
    `LENGTH: ${LENGTH_GUIDE[req.lengthHint] ?? LENGTH_GUIDE.medium}`,
    `LANGUAGE: write the subject and the body in ${languageName(req.language)}.` +
      (req.language === "en"
        ? ""
        : ` Write as somebody who thinks in ${languageName(req.language)}, not as somebody translating from English.`),
  ];

  if (req.avoid.length > 0) {
    parts.push(
      "",
      // ⚠️ Said plainly, and still not relied upon. The register rejects a
      // repeat afterwards whether or not the model read this list.
      `ALREADY POSTED — do not write about any of these again, and do not write a rephrasing of one:\n` +
        req.avoid.slice(0, 60).map((s) => `- ${s}`).join("\n"),
    );
  }

  if (req.previousObjections?.length) {
    parts.push(
      "",
      `YOUR PREVIOUS DRAFT WAS REJECTED. Do not repeat the problem:\n` +
        req.previousObjections.map((o) => `- ${o}`).join("\n"),
    );
  }

  parts.push("", responseShape(req.contentType === "carousel"));
  return parts.join("\n");
}

/**
 * Pull the JSON out of a model reply.
 *
 * ⚠️ Models fence JSON in markdown roughly half the time however firmly they
 * are asked not to. ⛔ Throwing on a fence would mean half the runs failing for
 * a reason that has nothing to do with the content.
 */
export function parseWritten(text: string): Written {
  /**
   * ⚠️ NO FENCE-STRIPPING STEP, deliberately. An earlier version stripped
   * ```` ```json ```` and the closing fence first — and a mutation run showed
   * that deleting those two lines broke nothing, because taking the text
   * between the first `{` and the last `}` already handles a fence, commentary
   * before it, and commentary after it.
   *
   * ⛔ Dead code that looks load-bearing is worse than a missing case: the next
   * person reads it and assumes fences are the only wrapping handled.
   */
  const cleaned = text.trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) {
    throw new Error(`social/writer: no JSON object in the reply. Got: ${cleaned.slice(0, 200)}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned.slice(start, end + 1));
  } catch (e) {
    throw new Error(`social/writer: the reply was not valid JSON — ${(e as Error).message}`);
  }

  const obj = parsed as Record<string, unknown>;
  const subject = typeof obj.subject === "string" ? obj.subject.trim() : "";
  const body = typeof obj.body === "string" ? obj.body.trim() : "";
  const support = typeof obj.support === "string" ? obj.support.trim() : "";

  if (!subject || !body) {
    throw new Error(
      `social/writer: the reply is missing ${!subject ? "a subject" : "a body"}. ` +
        `⛔ Not filled in with a default — an empty subject would poison the register.`,
    );
  }

  /**
   * 🔑 SLIDES, WHEN THE REPLY CARRIES THEM.
   *
   * ⛔ Each one shape-checked and trimmed, and anything that is not a
   * non-empty string is DROPPED rather than coerced. A slide rendered from
   * `null` is a blank card published in the middle of a carousel — visible to
   * everyone, explicable by nobody.
   *
   * ⚠️ Instagram takes 2–10 items in a carousel and the subject is the first
   * card, so at most 9 may follow it. Over that, the extras are dropped here
   * rather than failing at publish: the post is still good at nine.
   */
  const slides = Array.isArray(obj.slides)
    ? (obj.slides as unknown[])
        .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
        .map((x) => x.trim())
        .slice(0, 9)
    : undefined;

  return {
    subject,
    body,
    support: support || undefined,
    slides: slides && slides.length > 0 ? slides : undefined,
  };
}

/**
 * The real writer.
 *
 * ⚠️ `noFallback` is deliberately NOT set: unlike the daily quote, this caller
 * keeps whatever it gets, so the second engine is worth paying for rather than
 * a wasted call ⇒ the U19 note in aiClient.
 */
export async function writeWithModel(req: WriteRequest): Promise<Written> {
  const res = await callImotaraAI(buildPrompt(req), {
    system:
      "You write short, plain, unhurried social posts for a mental-health companion app. " +
      "You never claim a clinical role for it. You reply with JSON only.",
    maxTokens: 700,
    temperature: 0.85,
    abortMs: 45_000,
  });

  if (!res.text?.trim()) {
    throw new Error(
      `social/writer: the model returned nothing (${res.meta.from}${res.meta.reason ? `: ${res.meta.reason}` : ""}).`,
    );
  }
  return parseWritten(res.text);
}
