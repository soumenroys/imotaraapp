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

    /**
     * Phase-2 (still v1): Conversational humanization guidance.
     * These are OPTIONAL so no existing features break if callers ignore them.
     */
    goals?: string[];

    hardRules?: string[];

    flow?: {
        softMirror?: { lines?: [1, 2] | [1, 3] | [2, 3] };
        meaningBridge?: { lines?: [1, 2] | [1, 3] | [2, 3] };
        oneNextMove?: { count?: 1 };
        openDoor?: { type?: "question_or_permission"; count?: 1 };
    };
};

// ---- Canonical Imotara Response Contract (Platform-agnostic) ----

export type ReflectionIntent = "reflect" | "clarify" | "reframe";

export interface ReflectionSeed {
    title: string; // short label shown to user
    prompt: string; // 1-line reflective prompt
    intent: ReflectionIntent;
}

export interface ImotaraResponse {
    reflectionSeed?: ReflectionSeed;
    message: string;
    followUp?: string;

    // Contract versions (optional for backward compatibility)
    meta?: {
        styleContract: "1.0";
        blueprint: "1.0";
    };
}

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

    // --- Phase-2 humanization guidance (still v1) ---
    goals: [
        "Single flowing voice; no visible step-structure.",
        "Empathy + meaning + one next move woven together.",
        "Short, calm, non-lecture tone.",
    ],

    hardRules: [
        "No headings, no numbered structure, no explicit 'analysis' labels.",
        "Default to paragraphs; avoid bullets unless user explicitly asks.",
        "Avoid advice-stacking: ONE next move only.",
        "Keep it short: typically 8–10 lines max for normal inputs.",
        "End with either ONE easy question or a permission line (not both).",
    ],

    flow: {
        softMirror: { lines: [1, 2] },
        meaningBridge: { lines: [1, 3] },
        oneNextMove: { count: 1 },
        openDoor: { type: "question_or_permission", count: 1 },
    },
};
