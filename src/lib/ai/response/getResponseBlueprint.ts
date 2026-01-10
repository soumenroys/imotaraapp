// src/lib/ai/response/getResponseBlueprint.ts
import {
    DEFAULT_RESPONSE_BLUEPRINT,
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
    const base = DEFAULT_RESPONSE_BLUEPRINT;

    return {
        ...base,

        // Existing overrides (unchanged behavior)
        tone: opts?.tone ?? base.tone,
        structureLevel: opts?.structureLevel ?? base.structureLevel,

        reflectionSeedCard: {
            ...base.reflectionSeedCard,
            enabled: opts?.reflectionEnabled ?? base.reflectionSeedCard.enabled,
        },

        // --- Phase-2 (still v1): pass-through only ---
        // These fields are advisory and do not change behavior yet.
        goals: base.goals,
        hardRules: base.hardRules,
        flow: base.flow,
    };
}
