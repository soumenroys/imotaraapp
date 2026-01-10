// src/types/analysis.ts

// Core emotion palette we’ll use locally and (later) align with any backend
export type Emotion =
  | "joy"
  | "sadness"
  | "anger"
  | "fear"
  | "disgust"
  | "surprise"
  | "neutral";

// Lightweight tag we can attach to messages/reflections
export type EmotionTag = {
  emotion: Emotion;
  // 0 → none, 1 → very strong
  intensity: number; // 0..1
  // where did we get this tag from?
  source: "local" | "model" | "user";
  // positionally optional: word offsets when we add NLP later
  span?: { start: number; end: number };
};

// ───────────────────────────────────────────────────────────────────────────────
// INPUT SHAPES
// ───────────────────────────────────────────────────────────────────────────────

// A single user message (or journal line) to analyze locally
// NOTE: For compatibility, we keep both `text` (existing) and `message` (new).
//       Use `message ?? text` at call sites if needed.
export type AnalysisInput = {
  id: string;               // message id in your chat log
  /** Canonical message field going forward */
  message?: string;
  /** Legacy alias kept for older call sites */
  text?: string;
  createdAt?: number;       // epoch ms (optional to avoid SSR hydration diffs)
  role?: "user" | "assistant";
};

// ───────────────────────────────────────────────────────────────────────────────
// PER-MESSAGE ANALYSIS
// ───────────────────────────────────────────────────────────────────────────────

// Rich per-message outcome (your current model)
export type PerMessageAnalysis = {
  id: string;               // mirrors AnalysisInput.id
  dominant: EmotionTag;     // the “winner” emotion for this message
  all: EmotionTag[];        // full distribution (sparse allowed)
  // quick heuristics we can show or hide in UI tooltips
  heuristics?: {
    polarity: number;       // -1..1 (negative..positive)
    arousal?: number;       // 0..1 (calm..excited) — reserved
  };

  // Back-compat minimal fields (for simpler analyzers / tooling)
  // These mirror the lightweight shape some modules expect.
  emotion?: Emotion;        // equals dominant.emotion
  intensity?: number;       // equals dominant.intensity
  explanation?: string;     // brief reason string when provided
};

// ───────────────────────────────────────────────────────────────────────────────
// REFLECTIONS & SNAPSHOTS
// ───────────────────────────────────────────────────────────────────────────────

// Reflection is a short natural-language note about recent feelings
export type Reflection = {
  text: string;             // e.g., “You sounded relieved after finishing the task.”
  createdAt: number;        // epoch ms
  // optional links to the messages that influenced this reflection
  relatedIds?: string[];
};

// Rolling mood snapshot for the last N items (e.g., 7 messages or 24h)
export type MoodSnapshot = {
  window: { from: number; to: number }; // epoch ms range  ✅ fixed colon
  // weighted average intensity per emotion in the window
  averages: Partial<Record<Emotion, number>>; // 0..1 per emotion
  dominant: Emotion; // the highest average emotion
};

// Short, UI-friendly summary for the Mood Summary Card
export type MoodSummary = {
  headline: string;   // e.g., “Mostly calm with moments of joy”
  details?: string;   // one-liner: “Positivity trended up this evening.”
};

// ───────────────────────────────────────────────────────────────────────────────
// BATCH RESULT
// ───────────────────────────────────────────────────────────────────────────────

// What the analyzer returns for a batch of messages (rich model)
export type AnalysisResult = {
  perMessage: PerMessageAnalysis[];
  snapshot: MoodSnapshot;     // last window (we’ll start with ‘last 10 msgs’)
  summary: MoodSummary;       // 1–2 lines for the card
  reflections: Reflection[];  // zero or more short notes

  /**
   * Optional: separate Reflection Seed Card prompts for UI.
   * Backward compatible: chat reflections remain unchanged.
   */
  reflectionSeedCard?: {
    prompts: string[];     // 1–2 short prompts
    createdAt: number;
    relatedIds: string[];  // message ids relevant to the seed
  };

  computedAt: number;         // epoch ms

  // Back-compat fields for simpler analyzers:
  // `timestamp` mirrors `computedAt`
  // `items` mirrors `perMessage` in a simplified shape
  timestamp?: number;
  items?: Array<{
    id: string;
    emotion: Emotion;
    intensity: number;
    explanation?: string;
  }>;
};

// ───────────────────────────────────────────────────────────────────────────────
// FUNCTION SIGNATURES
// ───────────────────────────────────────────────────────────────────────────────

// The local analyzer function signature (pure & side-effect free)
export type AnalyzeLocal = (
  inputs: AnalysisInput[],
  options?: {
    // how many recent messages to include in snapshot (default: 10)
    windowSize?: number;
  }
) => Promise<AnalysisResult>;
