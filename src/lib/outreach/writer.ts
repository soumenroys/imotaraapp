// src/lib/outreach/writer.ts
// Writes one outreach email draft — for one audience and one step — and checks it.
//
// 🔑 ONE DRAFT PER AUDIENCE × STEP, NOT ONE PER PERSON. Twenty drafts a person
// can actually read and approve, then merged with each contact's name and
// organisation at send time. A letter written fresh for every recipient is
// twenty letters nobody read ⇒ the owner chose "review first, then auto".
//
// ⛔ THE MODEL GETS THE CHECKED FACTS AND NOTHING ELSE TO CLAIM. Left to itself
// it invents a statistic, a client, a study ⇒ trap_a_model_invents_specifics_it_cannot_have.
// The facts are the social writer's, so one list is kept true, not two.
//
// ⚠️ THE STYLE RULES ARE THE BROADCAST TEMPLATES' — a deliverability decision
// (Gmail files campaign-looking mail under Promotions or Spam), measured on
// this domain ⇒ src/lib/broadcast/templates/types.ts. They are checked here in
// code, not just asked for.

import { callImotaraAI } from "@/lib/imotara/aiClient";
import { FACTS } from "@/lib/social/writer";
import { checkVoice, NOTHING_SENT } from "@/lib/social/voiceGate";
import { templatesFor } from "@/lib/broadcast/templates";
import { SITE } from "@/lib/broadcast/templates/types";
import { AUDIENCE_LABEL, STEP_LABEL, type Audience, type StepId } from "@/lib/outreach/sequence";

export const SIGNATURE = "— Suchismita Sen, Imotara";

const STEP_BRIEF: Record<StepId, string> = {
  intro:
    "The FIRST email this person gets from us. Introduce Imotara by way of one concrete problem this audience has. " +
    "They agreed to hear from us, but may not remember us — so be relevant from the very first line instead of explaining who we are.",
  followup:
    "A follow-up one week after the introduction, which got no reply. Shorter than the introduction. Bring ONE new, different true fact " +
    "they did not get last time. Do not guilt them for not replying; do not say 'just following up' or 'bumping this'.",
  last:
    "The last note, three weeks after the introduction. Very short. Say plainly this is the last time we will write unless they want more, " +
    "and leave the door open with one easy question.",
  info:
    "They spoke to our virtual assistant on a phone call and ASKED for details. Thank them for the call in one line, then give the details " +
    "this audience would need to decide: what Imotara is, what it is not, privacy, languages, and how to try it. Still one link only.",
};

/**
 * 🔑 WHAT EACH AUDIENCE CARES ABOUT, AND WHICH TRUE FEATURES ANSWER IT.
 * Owner, 24 Oct 2026: "highlight Imotara advantages and uniqueness … always
 * highlight their interest with imotara features". ⛔ Every feature named here
 * is on the FACTS list — this chooses and orders, it never adds a claim.
 */
/**
 * ⚠️ "WORKS OFFLINE" MEANS TYPING. Speaking is transcribed on a server ⇒ needs
 * a connection. Eldercare leads with speaking, so it does not mention offline
 * at all — the two side by side read as one claim ⇒ offlineMeansTypingNotSpeaking.
 */
export const AUDIENCE_FOCUS: Record<Audience, { cares: string; lead: string; avoid: string }> = {
  individuals: {
    cares: "a private place to say how they really feel, in their own words and language, at any hour, without being judged or tracked",
    lead: "privacy (stays on their own phone by default) · 22 languages incl. 11 Indian · type or speak · typing works even offline (speaking needs a connection) · remembers what mattered last time · no feed, streaks or badges · free to start",
    avoid: "Do not lecture about mental health. Write to one person.",
  },
  ngos: {
    cares: "field staff, volunteers and the people they serve — often across languages and with patchy signal — and nothing extra for an already stretched team to run",
    lead: "11 Indian languages, replies in the language they write in · typing works even with patchy signal (speaking needs a connection) · private: conversations stay on the device, so nothing reaches a supervisor · asks no training or admin effort · Imotara Connect human peer companions (not counsellors)",
    avoid: "Do not claim it replaces counselling or any programme they run.",
  },
  education: {
    cares: "students in colleges and universities and their staff, who need somewhere private to think aloud between lectures, exams and counselling appointments",
    lead: "privacy — nothing is shared with the institution · their own language · any hour, including the night before an exam · no feed, streaks or addictive mechanics · alongside the counselling service, never instead of it",
    avoid: "⛔ Never suggest it is for children or anyone under 13; speak of college and university students and staff.",
  },
  eldercare: {
    cares: "residents who want someone to talk to between visits, often more comfortable speaking than typing and in their mother tongue, and caregivers who cannot be everywhere",
    lead: "speak instead of type · their mother tongue among 22 languages · remembers what mattered last time, so they need not repeat themselves · no feed or anything to keep up with",
    avoid: "Loneliness may be named, but with dignity — never as helplessness; speak of company and continuity.",
  },
  corporates: {
    cares: "employee wellbeing that people will actually use because it is genuinely private, across a workforce that speaks many languages and works all hours",
    lead: "private — the employer never sees conversations; stays on the device by default · 22 languages · any hour, any shift · no app fatigue: no feed, streaks or badges · complements an EAP, does not replace it",
    avoid: "Do not promise productivity or ROI figures.",
  },
};

const BANNED = [
  "act now", "limited time", "don't miss", "dont miss", "hurry", "special offer", "discount", "click here", "buy now",
  "order now", "risk-free", "no obligation", "guaranteed", "100%", "exclusive deal", "sign up now", "register now",
  "best price", "cheap", "winner", "just following up", "bumping this", "circling back",
  "earn", "cash", "deal", "offer", "urgent", "last chance", "act fast", "amazing", "incredible", "revolutionary",
  "dear friend", "congratulations", "100% free", "risk free", "unsubscribe here",
];

/** ⇒ now lives in the social gate, so posts and emails share ONE rule (30 Oct 2026). */
export { NOTHING_SENT };

/** The house-style checks a draft must pass — the broadcast templates' rules, in code. */
export function checkMailStyle(subject: string, body: string): string[] {
  const out: string[] = [];
  const hay = `${subject}\n${body}`.toLowerCase();
  if (!subject.trim()) out.push("The subject is empty.");
  if (subject.length > 70) out.push("The subject is too long for a phone inbox (keep it under 70 characters).");
  if (subject.includes("!")) out.push("No exclamation marks in the subject.");
  // ⚠️ Spam filters weigh these heavily in a subject line.
  if (/\bfree\b|[₹$%]|^\s*(re|fwd?):/i.test(subject)) out.push("No “free”, currency, percentages or fake Re:/Fwd: in the subject.");
  if ((body.match(/!/g) ?? []).length > 1) out.push("At most one exclamation mark in the body.");
  if (/\b[A-Z]{5,}\b/.test(body.replace(/\bIMOTARA\b/g, ""))) out.push("No SHOUTED words in the body.");
  if (/\b[A-Z]{4,}\b/.test(subject.replace(/\bIMOTARA\b/g, ""))) out.push("No SHOUTED words in the subject.");
  // ⚠️ Whole words: "earn" must not fire on "learn", nor "deal" on "ideal".
  for (const w of BANNED) {
    const re = new RegExp(`(^|[^a-z])${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|[^a-z])`, "i");
    if (re.test(hay)) out.push(`Promotional wording: “${w}”.`);
  }
  /**
   * ⛔ "STAYS ON THE DEVICE" IS STORAGE. Each message's text is sent to an AI
   * service for the reply (cloud is the default on web and mobile), so a
   * sentence saying nothing leaves the phone is false — the writer drew it
   * from the true one on 28 Oct, in 4 of 20 drafts ⇒ storedIsNotSent.
   */
  if (NOTHING_SENT.test(hay)) out.push("Says nothing leaves the phone — false: each message is sent to an AI service for the reply. Say it is STORED on the device.");
  const links = body.match(/https?:\/\/\S+/g) ?? [];
  if (links.length > 1) out.push("At most one link.");
  if (links.some((l) => !l.startsWith(SITE))) out.push(`The only link allowed is ${SITE}.`);
  if (/!\[|<img|\[button/i.test(body)) out.push("No images or buttons.");
  if (!/\{\{name\|[^}]+\}\}/.test(body)) out.push("It must greet by name with a fallback, like Hello {{name|there}},");
  if (!body.trim().split("\n").slice(-6).join(" ").includes("?")) out.push("It must end by asking something they can answer.");
  if (!body.includes(SIGNATURE)) out.push(`It must be signed “${SIGNATURE}”.`);
  return out;
}

/** Every check a draft goes through: the social word check (clinical claims, abuse, care) and the house style. */
export function checkDraft(subject: string, body: string): string[] {
  const gate = checkVoice(`${subject}\n${body}`, "en");
  return [...gate.findings.map((f) => `${f.rule}: “${f.matched}” — ${f.because}`), ...checkMailStyle(subject, body)];
}

export function buildMailPrompt(audience: Audience, step: StepId): string {
  const examples = templatesFor(audience)
    .slice(0, 2)
    .map((t, i) => `EXAMPLE ${i + 1}\nSubject: ${t.subject}\n\n${t.body}`)
    .join("\n\n---\n\n");
  return `
You are writing ONE short email from Imotara to ${AUDIENCE_LABEL[audience]}.

WHAT THIS READER CARES ABOUT: ${AUDIENCE_FOCUS[audience].cares}.
LEAD WITH THEIR INTEREST, then show how Imotara answers it — choose the one or two most relevant of these
true strengths, and say WHY each matters to THIS reader (not a list of features):
${AUDIENCE_FOCUS[audience].lead}
${AUDIENCE_FOCUS[audience].avoid}

WHICH EMAIL THIS IS: ${STEP_LABEL[step]}.
${STEP_BRIEF[step]}

${FACTS}

HOW IT MUST READ — like a person wrote it to one person, not a campaign (spam filters and readers both judge this):
- No marketing tone, no superlatives, no urgency, no "offer", no prices, no "free" in the subject.
- Plain text paragraphs. No headings, no bullet lists, no bold, no images, no buttons.
- Open exactly with: Hello {{name|there}},
- You may use {{organisation}} once where the organisation's name fits naturally (it can be empty — write so the sentence still reads if it is).
- 90 to 170 words in the body.
- At most ONE link, and only this one: ${SITE}
- No exclamation marks in the subject; no SHOUTING; none of these words: ${BANNED.join(", ")}.
- It must NEVER suggest Imotara is therapy, counselling, treatment, or a crisis service.
- End with ONE real question they could answer in a line.
- Sign off on the last line exactly: ${SIGNATURE}

Two letters this team has already approved, for tone only — do NOT copy their sentences:

${examples}

Reply with nothing but JSON: {"subject": "...", "body": "..."}
`.trim();
}

export function parseMail(text: string): { subject: string; body: string } {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("The writer did not return JSON.");
  const j = JSON.parse(text.slice(start, end + 1)) as { subject?: unknown; body?: unknown };
  const subject = String(j.subject ?? "").trim();
  const body = String(j.body ?? "").trim();
  if (!subject || !body) throw new Error("The writer returned an empty subject or body.");
  return { subject, body };
}

/**
 * Write a draft, retrying up to twice when the checks find something.
 * Returns the last attempt either way, with its findings — a draft with
 * findings can never be approved without being edited ⇒ the admin route.
 */
export async function writeMailDraft(audience: Audience, step: StepId): Promise<{ subject: string; body: string; findings: string[] }> {
  let last: { subject: string; body: string; findings: string[] } | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await callImotaraAI(buildMailPrompt(audience, step), {
      system: "You write short, plain, honest emails for a wellbeing companion app. You never claim a clinical role for it. You reply with JSON only.",
      maxTokens: 700,
      temperature: 0.7,
      abortMs: 45_000,
      feature: "outreach",
    });
    if (!res.text?.trim()) throw new Error(`The writer returned nothing (${res.meta.from}).`);
    const { subject, body } = parseMail(res.text);
    last = { subject, body, findings: checkDraft(subject, body) };
    if (last.findings.length === 0) return last;
  }
  return last!;
}
