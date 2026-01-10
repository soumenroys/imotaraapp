// src/lib/ai/response/getResponseBlueprint.ts
import {
    DEFAULT_RESPONSE_BLUEPRINT,
    type ResponseBlueprint,
    type ResponseTone,
} from "./responseBlueprint";

/**
 * Single source of truth for response behavior.
 * No behavior change yet — just returns defaults.
 */
export function getResponseBlueprint(opts?: {
    tone?: ResponseTone;
    structureLevel?: ResponseBlueprint["structureLevel"];
    reflectionEnabled?: boolean;
}): ResponseBlueprint {
    const base = DEFAULT_RESPONSE_BLUEPRINT;

    return {
        ...base,
        tone: opts?.tone ?? base.tone,
        structureLevel: opts?.structureLevel ?? base.structureLevel,
        reflectionSeedCard: {
            ...base.reflectionSeedCard,
            enabled: opts?.reflectionEnabled ?? base.reflectionSeedCard.enabled,
        },
    };
}
