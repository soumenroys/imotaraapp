// src/lib/imotara/promptProfile.ts

import { getImotaraProfile } from "@/lib/imotara/profile";
import type { ResponseTone } from "@/lib/ai/response/responseBlueprint";

function fmt(v?: string) {
  return v && v.trim() ? v.trim() : undefined;
}

export function buildToneContextPromptSnippet(): string {
  const p = getImotaraProfile();
  if (!p) return "";

  const userName = fmt(p.user?.name);
  const userAge = p.user?.ageRange;
  const userGender = p.user?.gender;

  const enabled = !!p.companion?.enabled;
  const compName = enabled ? fmt(p.companion?.name) : undefined;
  const compAge = enabled ? p.companion?.ageRange : undefined;
  const compGender = enabled ? p.companion?.gender : undefined;
  const compRel = enabled ? p.companion?.relationship : undefined;

  // If nothing meaningful, don’t add anything
  const hasAny =
    userName ||
    userAge ||
    userGender ||
    compName ||
    compAge ||
    compGender ||
    compRel;

  if (!hasAny) return "";

  // Keep this concise and "tone only"
  return [
    "Tone & Context Guidance (tone only; do NOT claim to be a real person):",
    userName ? `- User name (optional): ${userName}` : "",
    userAge ? `- User age range: ${userAge}` : "",
    userGender ? `- User gender: ${userGender}` : "",
    enabled ? "- Preferred companion tone (wording guidance only):" : "",
    enabled && compRel ? `  - Relationship vibe: ${compRel}` : "",
    enabled && compAge ? `  - Age tone: ${compAge}` : "",
    enabled && compGender ? `  - Gender tone: ${compGender}` : "",
    enabled && compName ? `  - Companion name: ${compName}` : "",
    enabled
      ? "- Adjust warmth/directness/pacing accordingly, but stay privacy-first and avoid dependency cues."
      : "",
    "- Never say you are a parent/partner/friend/real person. You are Imotara: a reflective, privacy-first companion.",
  ]
    .filter(Boolean)
    .join("\n");
}

// -----------------------------
// Server-safe tone mapping helper
// -----------------------------

export type ToneGender =
  | "female"
  | "male"
  | "nonbinary"
  | "prefer_not"
  | "other";
export type ToneAgeRange =
  | "under_13"
  | "13_17"
  | "18_24"
  | "25_34"
  | "35_44"
  | "45_54"
  | "55_64"
  | "65_plus"
  | "prefer_not";

export type ToneRelationship =
  | "mentor"
  | "friend"
  | "elder"
  | "coach"
  | "parent_like"
  | "partner_like"
  | "junior_buddy"
  | "sibling"
  | "prefer_not";

export type ToneContextPayload = {
  user?: {
    name?: string;
    ageRange?: ToneAgeRange;
    gender?: ToneGender;
  };
  companion?: {
    enabled?: boolean;
    name?: string;
    ageRange?: ToneAgeRange;
    gender?: ToneGender;
    relationship?: ToneRelationship;
  };
};

/**
 * Central mapping from toneContext → ResponseTone.
 * Pure + server-safe (does not touch window/localStorage).
 */
export function deriveResponseToneFromToneContext(
  t?: ToneContextPayload,
): ResponseTone {
  const enabled = !!t?.companion?.enabled;
  const rel = enabled ? t?.companion?.relationship : undefined;

  switch (rel) {
    case "coach":
      return "coach";
    case "mentor":
      return "practical";
    case "friend":
    case "partner_like":
    case "junior_buddy":
    case "sibling":
      return "supportive";
    case "elder":
    case "parent_like":
      return "calm";
    default:
      return "calm";
  }
}

/**
 * Tone-aware "conversational bridge" directive.
 * Use this to shape the *closing line* so coach sounds like coach,
 * supportive sounds like supportive, etc. (Still max 1 question.)
 */
export function buildBridgeDirectiveForTone(tone: ResponseTone): string {
  switch (tone) {
    case "coach":
      return [
        "Conversational Bridge (Coach):",
        "- End with ONE tiny next move or ONE clarifying question (max 1).",
        "- Sound steady + practical (avoid over-soothing lines like 'I’m right here with you').",
        "- Example endings: 'Pick the one pressure point (workload/people/uncertainty) and we’ll do one small step.'",
      ].join("\n");

    case "supportive":
      return [
        "Conversational Bridge (Supportive):",
        "- End with gentle presence, then ONE optional question (max 1).",
        "- Avoid pushing action; offer choice: talk more vs tiny relief step.",
        "- Example endings: 'Do you want to tell me what part feels heaviest, or try one tiny easing step first?'",
      ].join("\n");

    case "practical":
      return [
        "Conversational Bridge (Practical):",
        "- End with ONE concrete option or ONE short question (max 1).",
        "- Keep it simple and specific (no long lists).",
        "- Example endings: 'Want a quick 2-minute reset or a small plan for the next hour?'",
      ].join("\n");

    case "calm":
    default:
      return [
        "Conversational Bridge (Calm):",
        "- End with slow reassurance + ONE gentle question (max 1) if helpful.",
        "- Keep language soft, not dramatic.",
        "- Example endings: 'No rush — what would feel a little lighter right now?'",
      ].join("\n");
  }
}
