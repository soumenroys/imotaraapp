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
HOW TO WRITE

- Write to one person. "You", never "users", never "our community".
- Say one true thing and stop. No list of benefits. No three-part structure.
- Leave room. A post that answers everything invites nothing. Where it is
  honest to end open, end open — but never with a manufactured question like
  "What do you think?" An open ending is a thought left standing, not a
  question begged.
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
- Emoji. More than two hashtags. More than one link.
- A testimonial, or a story about a person who does not exist.
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

function responseShape(): string {
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

export function buildPrompt(req: WriteRequest): string {
  const pools = TOPIC_POOLS.filter((p) => req.topicPool.includes(p.id));
  const angles = pools.length > 0 ? pools : TOPIC_POOLS;

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
            `Keep the body under ${spec.limits.soft} characters — that is where this channel folds ` +
            `it and the rest goes behind "see more". ` +
            (spec.hashtags === 0
              ? "Use no hashtags at all on this channel."
              : `At most ${spec.hashtags} hashtag${spec.hashtags === 1 ? "" : "s"}, and none is usually better.`),
          "",
          "⛔ Still for everyone. The channel changes the register, never the reader: no job title " +
            "addressed, no assumption about anybody's work, age, country or family.",
        ]
      : []),
    `TONE: ${req.tone}. LENGTH: ${req.lengthHint}.`,
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

  parts.push("", responseShape());
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

  return { subject, body, support: support || undefined };
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
