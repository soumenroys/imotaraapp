// src/lib/ai/response/responseBlueprint.ts

export type ResponseTone =
    | "calm"
    | "supportive"
    | "practical"
    | "coach"
    | "gentle-humor"
    | "direct";

export type ResponseSection =
    | "ack"          // brief human acknowledgement
    | "core"         // main helpful content
    | "options"      // short choices / next steps
    | "reflection"   // optional reflection seed (separate UI card)
    | "safety";      // only when required

export type ResponseBlueprint = {
    version: "v1";

    tone: ResponseTone;

    /**
     * 1 = free-flow natural
     * 5 = clearly structured
     */
    structureLevel: 1 | 2 | 3 | 4 | 5;

    sectionOrder: ResponseSection[];

    // Prevent explicit headings like "Summary", "Steps", etc.
    avoidHeadings: boolean;

    // Reflection is rendered as a separate calm card (not chat bubble)
    reflectionSeedCard: {
        enabled: boolean;
        maxPrompts: 1 | 2;
    };

    // Future-safe flag — no behavior yet
    memoryContinuity: {
        enabled: boolean;
        requiresConsent: true;
    };
};

export const DEFAULT_RESPONSE_BLUEPRINT: ResponseBlueprint = {
    version: "v1",
    tone: "calm",
    structureLevel: 3,
    sectionOrder: ["ack", "core", "options", "reflection", "safety"],
    avoidHeadings: true,
    reflectionSeedCard: {
        enabled: true,
        maxPrompts: 2,
    },
    memoryContinuity: {
        enabled: false,
        requiresConsent: true,
    },
};
