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

  // Age/gender guidance helpers
  const genderVoiceHint = (gender?: string, role: "companion" | "user" = "companion") => {
    if (!gender || gender === "prefer_not" || gender === "other") return "";
    if (role === "companion") {
      if (gender === "female") {
        return "  - Companion voice: use feminine first-person verb forms when the language requires it (e.g., Hindi: 'sun rahi hoon' not 'sun raha hoon', 'samajh gayi' not 'samajh gaya').";
      }
      if (gender === "nonbinary") {
        return "  - Companion voice: use neutral/gender-inclusive forms; avoid strongly gendered verb endings.";
      }
    }
    if (role === "user") {
      if (gender === "female") {
        return `  - User gender: female — use feminine second-person agreement in gendered languages (e.g., Hindi: 'ho rahi ho', 'sambhal logi').`;
      }
      if (gender === "male") {
        return `  - User gender: male — use masculine second-person agreement in gendered languages.`;
      }
    }
    return "";
  };

  const ageVoiceHint = (age?: string, role: "companion" | "user" = "user") => {
    if (!age || age === "prefer_not") return "";
    if (role === "user") {
      if (age === "under_13") return "  - User is a child (under 13): keep language very simple, gentle, and age-appropriate. Avoid adult concepts.";
      if (age === "13_17") return "  - User is a teenager (13–17): be warm and peer-supportive; avoid sounding parental.";
      if (age === "65_plus") return "  - User is older adult (65+): use unhurried, respectful language; no need to rush them.";
    }
    if (role === "companion") {
      if (age === "under_13" || age === "13_17") return "  - Companion age is young: use a lighter, peer-like tone.";
      if (age === "65_plus") return "  - Companion age is elder: use a calm, wise, unhurried tone.";
    }
    return "";
  };

  const compVoiceHint = genderVoiceHint(compGender, "companion");
  const userGenderHint = genderVoiceHint(userGender, "user");
  const userAgeHint = ageVoiceHint(userAge, "user");
  const compAgeHint = ageVoiceHint(compAge, "companion");

  // Keep this concise and "tone only"
  return [
    "Tone & Context Guidance (tone only; do NOT claim to be a real person):",
    userName
      ? `- User name: ${userName} — address them by name occasionally (roughly 1 in 3 replies, never every reply). Use it naturally, e.g. at the start of a sentence: "${userName}, that sounds really hard." Avoid repeating it in the same message.`
      : "",
    userAge ? `- User age range: ${userAge}` : "",
    userAgeHint,
    userGender ? `- User gender: ${userGender}` : "",
    userGenderHint,
    enabled ? "- Preferred companion tone (wording guidance only):" : "",
    enabled && compRel ? `  - Relationship vibe: ${compRel}` : "",
    enabled && compAge ? `  - Companion age tone: ${compAge}` : "",
    compAgeHint,
    enabled && compGender ? `  - Companion gender: ${compGender}` : "",
    compVoiceHint,
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
// #2: Long-term emotional memory summary for cloud prompt injection
// -----------------------------

/**
 * Reads the last N emotion records from localStorage and returns a compact
 * natural-language summary suitable for injecting into the AI system prompt.
 * Client-side only — returns "" on server.
 */
export function buildEmotionMemorySummary(maxRecords = 30): string {
  if (typeof window === "undefined") return "";

  try {
    const raw =
      window.localStorage.getItem("imotara:history:v1") ??
      window.localStorage.getItem("imotara.history.v1");
    if (!raw) return "";

    const parsed = JSON.parse(raw) as any[];
    if (!Array.isArray(parsed) || parsed.length === 0) return "";

    // Take the most recent N non-deleted records with an emotion
    const recent = parsed
      .filter((r) => !r.deleted && r.emotion && r.emotion !== "neutral")
      .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
      .slice(0, maxRecords);

    if (recent.length === 0) return "";

    // Count emotion frequencies
    const freq: Record<string, number> = {};
    for (const r of recent) {
      freq[r.emotion] = (freq[r.emotion] ?? 0) + 1;
    }

    // Top 3 emotions by frequency
    const top = Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([e, c]) => `${e} (${c}×)`);

    // Average intensity
    const avgIntensity =
      recent.reduce((s, r) => s + (r.intensity ?? 0.5), 0) / recent.length;
    const intensityLabel =
      avgIntensity > 0.7 ? "high" : avgIntensity > 0.4 ? "moderate" : "low";

    // Rough time span
    const oldest = recent[recent.length - 1]?.createdAt ?? Date.now();
    const daySpan = Math.round((Date.now() - oldest) / 86_400_000);
    const spanLabel = daySpan <= 1 ? "today" : daySpan <= 7 ? `last ${daySpan} days` : `last ${Math.round(daySpan / 7)} weeks`;

    return [
      "User Emotional History (from stored data — use for context, not as script):",
      `- Dominant emotions over ${spanLabel}: ${top.join(", ")}`,
      `- Overall intensity trend: ${intensityLabel}`,
      "- Do not reference this data directly. Use it only to calibrate empathy depth and word choice.",
    ].join("\n");
  } catch {
    return "";
  }
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
  const compAge = enabled ? t?.companion?.ageRange : undefined;

  // Relationship takes priority over age-based fallback
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
      break;
  }

  // No relationship set — use companion age as secondary signal
  if (compAge === "under_13" || compAge === "13_17") return "supportive";
  if (compAge === "65_plus" || compAge === "55_64") return "calm";

  return "calm";
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
