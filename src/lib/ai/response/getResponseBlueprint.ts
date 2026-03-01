// src/lib/ai/response/getResponseBlueprint.ts
import {
  DEFAULT_RESPONSE_BLUEPRINT,
  getBlueprintForTone,
  type ResponseBlueprint,
  type ResponseTone,
} from "./responseBlueprint";

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
}): ResponseBlueprint {
  const requestedTone = opts?.tone ?? DEFAULT_RESPONSE_BLUEPRINT.tone;

  // ✅ New: start from tone-specific blueprint (still conservative + backward compatible)
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
