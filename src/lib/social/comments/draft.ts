// src/lib/social/comments/draft.ts
// A short public reply to a genuine comment — a DRAFT for the owner to approve.
//
// 🔑 Owner, 31 Oct 2026 (task #51): draft → approve first; automatic only once
// the drafts are measured good. ⛔ Nothing here sends anything.

import { callImotaraAI } from "@/lib/imotara/aiClient";
import { isSupportedLanguage } from "@/lib/social/languages";
import { checkVoice, findAiTells } from "@/lib/social/voiceGate";

/** Replies are short: a comment thread is not a post. */
export const MAX_REPLY_CHARS = 280;

export function replyPrompt(c: { text: string; postSnippet: string }): string {
  return [
    "Someone left this public comment under a post by Imotara, a private companion app for emotional wellbeing.",
    `Post: "${c.postSnippet}"`,
    `Comment: "${c.text}"`,
    "",
    "Write Imotara's public reply.",
    "- In the SAME language and script as the comment.",
    "- One or two short sentences, warm and plain, like a person. Thank them or answer what they asked.",
    "- Never claim therapy, counselling, treatment or any clinical role. Never say 'AI'. No country, price or currency.",
    "- No hashtags, no links, at most one emoji. Do not ask them to DM or message us.",
    `- At most ${MAX_REPLY_CHARS} characters.`,
    'Reply with JSON only: {"language": "<ISO 639-1 code of the comment>", "reply": "<the reply>"}',
  ].join("\n");
}

export type Draft = { reply: string; language: string; note: string | null };

/** Parses the model's answer; checks it against the house rules; never throws on a weak draft — it flags it. */
export function readDraft(raw: string): Draft {
  const m = raw.match(/\{[\s\S]*\}/);
  let reply = "";
  let language = "en";
  try {
    const j = JSON.parse(m?.[0] ?? "{}") as { reply?: string; language?: string };
    reply = String(j.reply ?? "").trim();
    language = String(j.language ?? "en").trim().toLowerCase();
  } catch {
    reply = "";
  }
  if (!isSupportedLanguage(language)) language = "en";
  const notes: string[] = [];
  if (!reply) notes.push("the model wrote nothing usable — write the reply yourself");
  if (reply.length > MAX_REPLY_CHARS) notes.push(`longer than ${MAX_REPLY_CHARS} characters`);
  if (reply) {
    const gate = checkVoice(reply, language);
    if (!gate.ok) notes.push(`house rules: ${gate.findings.map((f) => f.matched).join(", ")}`);
    const tells = findAiTells(reply);
    if (tells.length) notes.push(`sounds machine-written: ${tells.join(", ")}`);
  }
  return { reply, language, note: notes.length ? `⚠️ ${notes.join("; ")}` : null };
}

export async function draftReply(c: { text: string; postSnippet: string }): Promise<Draft> {
  const res = await callImotaraAI(replyPrompt(c), {
    system: "You write short, kind public replies for a wellbeing app's social accounts. You reply with JSON only.",
    maxTokens: 300,
    temperature: 0.7,
    abortMs: 30_000,
    feature: "social",
  });
  return readDraft(res.text ?? "");
}
