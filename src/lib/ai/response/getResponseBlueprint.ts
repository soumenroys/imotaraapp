// src/lib/ai/response/getResponseBlueprint.ts
import {
  DEFAULT_RESPONSE_BLUEPRINT,
  getBlueprintForTone,
  type ResponseBlueprint,
  type ResponseTone,
} from "./responseBlueprint";

/**
 * Tiny context bias (v1):
 * If caller did NOT request a tone, infer a *light* tone bias from the latest user text.
 * This keeps behavior backward compatible and avoids heavy NLP.
 */
function inferAutoToneFromText(text?: string): ResponseTone | null {
  const t = String(text ?? "")
    .toLowerCase()
    .trim();
  if (!t) return null;

  // Work / study stress → coach-y (gentle structure + “one next move”)
  if (
    /\b(work|office|boss|manager|client|deadline|meeting|shift|project|job|salary|performance|interview|exam|study|college|school)\b/.test(
      t,
    )
  ) {
    return "coach";
  }

  // Burnout / existential tired → supportive (validation + meaning)
  if (
    /\b(burn(ed)?\s*out|burnout|exhausted|drained|empty|numb|done with|can’t take|can't take|what’s the point|what is the point|tired of everything)\b/.test(
      t,
    )
  ) {
    return "supportive";
  }

  // Low mood / sadness → supportive
  if (/\b(sad|down|hopeless|lonely|heartbroken|cry|crying)\b/.test(t)) {
    return "supportive";
  }

  // Simple “what do I do / help me” → practical (still gentle)
  if (/\b(what should i do|help me|how do i|how to|plan|steps?)\b/.test(t)) {
    return "practical";
  }

  return null;
}

/**
 * Single source of truth for response behavior.
 * Still v1.
 * Existing behavior preserved.
 * Humanization metadata is passed through without altering logic yet.
 */
export function getResponseBlueprint(opts?: {
  tone?: ResponseTone;
  structureLevel?: ResponseBlueprint["structureLevel"];
  reflectionEnabled?: boolean;

  /**
   * Optional: last user message text (or combined recent user text).
   * If provided and `tone` is not explicitly set, we infer a light tone bias.
   */
  contextText?: string;
}): ResponseBlueprint {
  const explicitTone = opts?.tone;
  const autoTone = explicitTone
    ? null
    : inferAutoToneFromText(opts?.contextText);

  const requestedTone =
    explicitTone ?? autoTone ?? DEFAULT_RESPONSE_BLUEPRINT.tone;

  // Start from tone-specific blueprint (still conservative + backward compatible)
  const base = getBlueprintForTone(requestedTone, DEFAULT_RESPONSE_BLUEPRINT);

  return {
    ...base,

    // Existing overrides (unchanged behavior)
    tone: requestedTone,
    structureLevel: opts?.structureLevel ?? base.structureLevel,

    reflectionSeedCard: {
      ...base.reflectionSeedCard,
      enabled: opts?.reflectionEnabled ?? base.reflectionSeedCard.enabled,
    },

    // Keep these explicit so it’s obvious what’s being shaped by tone
    goals: base.goals,
    hardRules: base.hardRules,
    flow: base.flow,
  };
}
