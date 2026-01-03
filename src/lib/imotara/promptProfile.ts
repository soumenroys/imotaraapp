// src/lib/imotara/promptProfile.ts

import { getImotaraProfile } from "@/lib/imotara/profile";

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
        userName || userAge || userGender || compName || compAge || compGender || compRel;

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
