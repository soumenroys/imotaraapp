// src/lib/social/comments/classify.ts
// What a comment under our post is, and so what happens to it.
//
// 🔑 OWNER, 31 Oct 2026: "we need to reply on facebook, x or other social media
// automatically whenever any user comments anything." Measured 1 Nov 2026 on
// the last 25 posts per channel: 0 genuine outside comments, 7 repost scams
// ("send me this post in DM"), 4 from our own team. ⇒ the order below.
//
// ⚠️ PURE ⇒ src/__tests__/social/commentReplies.test.ts.

import { isCrisisTier2 } from "@/lib/emotion/keywordMaps";

export type CommentKind = "team" | "spam" | "crisis" | "genuine";

/**
 * Our own accounts. Their comments are left alone — never hidden, never answered.
 * ⚠️ Facebook hides most commenters' names from our token, so a team comment
 * there can arrive nameless and is treated as an outsider's: it becomes a DRAFT
 * the owner rejects, never an automatic reply.
 */
export const TEAM_HANDLES = ["imotaraofficial", "tapankumarkarmakar"] as const;
export const TEAM_NAMES = ["imotara", "tapan kumar karmakar"] as const;

/**
 * 🔑 The repost scam, as it actually arrived (Oct 2026): "please SenD me ThIS
 * p0st💖", "Suprb💚Dear can we repost? Plz send me this post in DM💌", "Wow,
 * can we repost it, Send me this post DM 📬". Accounts posing as health pages
 * that want a DM. Plus the usual promotion lines.
 * ⚠️ Matched on a normalised copy: case folded, 0→o, so "p0st" is "post".
 */
const SPAM = [
  // ⚠️ "send ME/US" only: "I'll send this to my sister" is a reader sharing, not a scam.
  /\bsend\b.{0,10}\b(me|us)\b.{0,20}\b(post|pic|picture|photo|this|it)\b/,
  /\bsend\b.{0,20}\bto\s*(me|us)\b/,
  // "send this post please" — asking for it, with no one else it is going to.
  /\bsend\s*(this|the)\s*post\b(?!.{0,20}\bto\b)/,
  /\b(re-?post|repost)\b/,
  /\b(in|via|check)\s*(my|your|the)?\s*(dm|inbox)\b|\bdm\s*(me|us)\b/,
  /\b(promot(e|ion)|collab(oration)?|sponsor|paid partnership)\b/,
  /\b(follow\s*(me|back|us)|check\s*(my|our)\s*(page|profile|bio)|link in (my |our )?bio)\b/,
  /\b(crypto|bitcoin|forex|trading signals?|investment plan|giveaway|earn \$?\d+)\b/,
  /https?:\/\/|www\./,
];

const normalise = (s: string) => s.toLowerCase().replace(/0/g, "o").replace(/[^\p{L}\p{N}\s:/.$-]/gu, " ").replace(/\s+/g, " ").trim();

export function isSpam(text: string): boolean {
  const t = normalise(text);
  return SPAM.some((r) => r.test(t));
}

export function isTeam(author: string | null | undefined): boolean {
  const a = String(author ?? "").trim().toLowerCase();
  return !!a && ((TEAM_HANDLES as readonly string[]).includes(a) || (TEAM_NAMES as readonly string[]).includes(a));
}

/**
 * 🔴 CRISIS FIRST — before team, before spam. A person in distress who also
 * wrote "dm me" is a person in distress. ⇒ the same union detector the chat
 * uses (22 languages); ⛔ never narrowed ⇒ trap_crisis_card_two_detectors_two_platforms.
 */
export function classifyComment(c: { author?: string | null; text: string }): CommentKind {
  if (isCrisisTier2(c.text)) return "crisis";
  if (isTeam(c.author)) return "team";
  if (isSpam(c.text)) return "spam";
  return "genuine";
}

/**
 * The public reply to a crisis comment. Fixed words, never a model's.
 * 🔑 Worldwide (owner, 30 Oct 2026): no country, no number that only works in
 * one place — the local emergency number and findahelpline.com.
 */
export const CRISIS_REPLY =
  "We're really glad you said something. If you might hurt yourself or you're in danger, please call your local emergency number now. " +
  "findahelpline.com lists free, confidential helplines in your country. You don't have to carry this alone.";
