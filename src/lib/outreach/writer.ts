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
import { checkVoice } from "@/lib/social/voiceGate";
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

const BANNED = [
  "act now", "limited time", "don't miss", "dont miss", "hurry", "special offer", "discount", "click here", "buy now",
  "order now", "risk-free", "no obligation", "guaranteed", "100%", "exclusive deal", "sign up now", "register now",
  "best price", "cheap", "winner", "just following up", "bumping this", "circling back",
];

/** The house-style checks a draft must pass — the broadcast templates' rules, in code. */
export function checkMailStyle(subject: string, body: string): string[] {
  const out: string[] = [];
  const hay = `${subject}\n${body}`.toLowerCase();
  if (!subject.trim()) out.push("The subject is empty.");
  if (subject.length > 70) out.push("The subject is too long for a phone inbox (keep it under 70 characters).");
  if (subject.includes("!")) out.push("No exclamation marks in the subject.");
  if (/\b[A-Z]{4,}\b/.test(subject.replace(/\bIMOTARA\b/g, ""))) out.push("No SHOUTED words in the subject.");
  for (const w of BANNED) if (hay.includes(w)) out.push(`Promotional wording: “${w}”.`);
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

WHICH EMAIL THIS IS: ${STEP_LABEL[step]}.
${STEP_BRIEF[step]}

${FACTS}

HOW IT MUST READ — like a person wrote it to one person, not a campaign:
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
    });
    if (!res.text?.trim()) throw new Error(`The writer returned nothing (${res.meta.from}).`);
    const { subject, body } = parseMail(res.text);
    last = { subject, body, findings: checkDraft(subject, body) };
    if (last.findings.length === 0) return last;
  }
  return last!;
}
