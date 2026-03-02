// src/lib/ai/response/responseBlueprint.ts

export type ResponseTone =
  | "calm"
  | "supportive"
  | "practical"
  | "coach"
  | "gentle-humor"
  | "direct";

export type ResponseSection =
  | "ack" // brief human acknowledgement
  | "core" // main helpful content
  | "options" // short choices / next steps
  | "reflection" // optional reflection seed (separate UI card)
  | "safety"; // only when required

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

    // Debug / compatibility inspection (server-added; clients may ignore)
    blueprintUsed?: ResponseBlueprint;

    // Phase 4 — QA-only soft enforcement notes
    // (Clients should ignore; never show raw notes to end users.)
    softEnforcement?: {
      message?: {
        severity: "none" | "low";
        notes: string[];
      };
      followUp?: {
        severity: "none" | "low";
        notes: string[];
      };
    };
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
    "Depth-first: reflect what might be underneath before offering steps.",
    "For low-signal vulnerability (e.g., 'not feeling good', 'life'), presence is often enough.",
    "Vary phrasing; avoid repeating the same comfort lines too often across turns.",
    "Short, calm, non-lecture tone.",
  ],

  hardRules: [
    "No headings, no numbered structure, no explicit 'analysis' labels.",
    "Default to paragraphs; avoid bullets unless user explicitly asks.",
    "Avoid advice-stacking: at most ONE next move, and it can be omitted.",
    "Keep it short: often 2–6 lines for low-signal inputs; 8–10 lines max for normal inputs.",
    "For low-signal inputs, end with quiet presence most of the time (about 60%) and ask ONE gentle question only sometimes.",
    "If you do ask a question, keep it easy and permission-based. Never stack questions.",
  ],

  flow: {
    softMirror: { lines: [2, 3] },
    meaningBridge: { lines: [1, 2] },
    oneNextMove: { count: 1 },
    openDoor: { type: "question_or_permission", count: 1 },
  },
};

/**
 * Tone-level override knobs (conservative).
 * This does NOT change behavior until a caller chooses to use it.
 */
export const TONE_BLUEPRINT_OVERRIDES: Record<
  ResponseTone,
  Partial<
    Pick<
      ResponseBlueprint,
      "structureLevel" | "goals" | "hardRules" | "flow" | "reflectionSeedCard"
    >
  >
> = {
  calm: {},

  supportive: {
    structureLevel: 2,
    goals: [
      "Reflect with emotional depth first (name what might be underneath), then pause.",
      "Presence over progress for low-signal vulnerability (e.g., 'not feeling good', 'life').",
      "Only introduce a next move if the user asks for it or the context is clear enough.",
      "Vary phrasing; avoid leaning on the same comfort lines repeatedly across turns.",
    ],
    hardRules: [
      "No headings, no numbered structure, no explicit 'analysis' labels.",
      "Avoid advice-stacking: at most ONE next move, and it can be omitted.",
      "Use softer language (could / maybe / if you like), avoid commands.",
      "You may end with ONE gentle question OR a permission line OR quiet presence (no question required).",
    ],
    flow: {
      softMirror: { lines: [2, 3] },
      meaningBridge: { lines: [1, 2] },
      oneNextMove: { count: 1 },
      openDoor: { type: "question_or_permission", count: 1 },
    },
  },

  practical: {
    structureLevel: 4,
    // ✅ Practical turns should not show the reflection seed card.
    // These are “do it now” contexts (food / rest / quick plan), so continuity matters more.
    reflectionSeedCard: {
      enabled: false,
      maxPrompts: 1,
    },
    goals: [
      "Turn emotion into clarity without flattening it.",
      "Offer one concrete next action that’s small and doable right now.",
      "Keep it crisp; avoid motivational fluff.",
    ],
    hardRules: [
      "No headings, no explicit 'analysis' labels.",
      "Avoid advice-stacking: ONE next move only.",
      "If you give an action, make it tiny (under 2 minutes).",
      "End with ONE easy question OR a permission line (not both).",
    ],
    flow: {
      softMirror: { lines: [1, 2] },
      meaningBridge: { lines: [1, 2] },
      oneNextMove: { count: 1 },
      openDoor: { type: "question_or_permission", count: 1 },
    },
  },

  coach: {
    structureLevel: 4,
    goals: [
      "Support + momentum: validating but forward-moving.",
      "Make the next move feel simple, specific, and energizing.",
      "Use confident language while staying kind.",
    ],
    hardRules: [
      "No headings, no explicit 'analysis' labels.",
      "Avoid advice-stacking: ONE next move only.",
      "Prefer direct verbs (try / pick / start) but never shame the user.",
      "End with ONE easy question OR a permission line (not both).",
    ],
    flow: {
      softMirror: { lines: [1, 2] },
      meaningBridge: { lines: [1, 2] },
      oneNextMove: { count: 1 },
      openDoor: { type: "question_or_permission", count: 1 },
    },
  },

  "gentle-humor": {
    structureLevel: 2,
    goals: [
      "Lighten the emotional load without dismissing it.",
      "Use one small playful line if it fits; warmth stays primary.",
      "Then guide toward one tiny next move.",
    ],
    hardRules: [
      "No headings, no explicit 'analysis' labels.",
      "No sarcasm, no jokes about the user, no minimization.",
      "Avoid advice-stacking: ONE next move only.",
      "End with ONE easy question OR a permission line (not both).",
    ],
    flow: {
      softMirror: { lines: [1, 2] },
      meaningBridge: { lines: [1, 3] },
      oneNextMove: { count: 1 },
      openDoor: { type: "question_or_permission", count: 1 },
    },
  },

  direct: {
    structureLevel: 4,
    goals: [
      "Be concise and clear, but never cold.",
      "Name the likely core issue in plain language.",
      "Offer one decisive next move.",
    ],
    hardRules: [
      "No headings, no explicit 'analysis' labels.",
      "Avoid advice-stacking: ONE next move only.",
      "Use short sentences; cut filler.",
      "End with ONE easy question OR a permission line (not both).",
    ],
    flow: {
      softMirror: { lines: [1, 2] },
      meaningBridge: { lines: [1, 2] },
      oneNextMove: { count: 1 },
      openDoor: { type: "question_or_permission", count: 1 },
    },
  },
};

/**
 * Helper to get a per-tone blueprint, while preserving defaults.
 * Callers can adopt this gradually without breaking anything.
 */
export function getBlueprintForTone(
  tone: ResponseTone,
  base?: ResponseBlueprint,
): ResponseBlueprint {
  const b = base ?? DEFAULT_RESPONSE_BLUEPRINT;
  const o = TONE_BLUEPRINT_OVERRIDES[tone] ?? {};
  return {
    ...b,
    tone,
    structureLevel: o.structureLevel ?? b.structureLevel,

    reflectionSeedCard: o.reflectionSeedCard ?? b.reflectionSeedCard,

    goals: o.goals ?? b.goals,
    hardRules: o.hardRules ?? b.hardRules,
    flow: o.flow ?? b.flow,
  };
}
