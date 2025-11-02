// src/store/emotionHistory.ts
import { create, StateCreator } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Emotion, AnalysisResult } from "@/types/analysis";

/* ----------------------------- Types ----------------------------- */
export type EmotionRecord = {
  id: string;
  timestamp: number;
  emotion: Emotion;
  intensity: number;
  summary?: string;
};

type EmotionHistoryState = {
  records: EmotionRecord[];
  addRecord: (record: EmotionRecord) => void;
  bulkAdd: (results: AnalysisResult[]) => void;
  clear: () => void;
};

/* --------------------------- Helpers ----------------------------- */
const EMOTIONS: Emotion[] = [
  "joy",
  "sadness",
  "anger",
  "fear",
  "disgust",
  "surprise",
  "neutral",
];

const isEmotion = (v: unknown): v is Emotion =>
  typeof v === "string" && (EMOTIONS as readonly string[]).includes(v);

/** Safely read a nested path (e.g. ['overall','emotion']) from unknown input. */
function getPath(obj: unknown, path: readonly string[]): unknown {
  let cur: unknown = obj;
  for (const key of path) {
    if (!cur || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[key];
  }
  return cur;
}

function coerceEmotion(src: unknown): Emotion {
  const candidates: unknown[] = [
    getPath(src, ["overall", "emotion"]),
    getPath(src, ["overall", "dominantEmotion"]),
    getPath(src, ["dominantEmotion"]),
    getPath(src, ["emotion"]),
    getPath(src, ["tag", "emotion"]),
    getPath(src, ["summary", "dominant", "emotion"]),
    getPath(src, ["summary", "emotion"]),
  ];
  for (const c of candidates) {
    if (isEmotion(c)) return c;
  }
  return "neutral";
}

function coerceIntensity(src: unknown): number {
  const candidates: unknown[] = [
    getPath(src, ["overall", "intensity"]),
    getPath(src, ["intensity"]),
    getPath(src, ["score"]),
    getPath(src, ["overall", "confidence"]),
    getPath(src, ["confidence"]),
  ];
  for (const c of candidates) {
    if (typeof c === "number" && Number.isFinite(c)) {
      if (c > 1) return Math.max(0, Math.min(1, c / 100)); // assume percentage
      if (c < 0) return 0;
      return c;
    }
  }
  return 0.5;
}

function coerceSummary(src: unknown): string | undefined {
  const s = getPath(src, ["summary"]);
  if (s == null) return undefined;

  if (typeof s === "string") return s;

  if (typeof s === "object") {
    const so = s as Record<string, unknown>;

    const sentences = Array.isArray(so.sentences)
      ? (so.sentences as unknown[]).filter((x): x is string => typeof x === "string")
      : null;

    const textLike =
      (typeof so.text === "string" && so.text) ||
      (typeof so.note === "string" && so.note) ||
      (typeof so.overview === "string" && so.overview) ||
      (sentences && sentences.join(" ")) ||
      (typeof so.brief === "string" && so.brief);

    if (textLike) return String(textLike).slice(0, 500);

    try {
      const json = JSON.stringify(s);
      return json.length > 500 ? json.slice(0, 497) + "..." : json;
    } catch {
      return undefined;
    }
  }

  return undefined;
}

/* ------------------------ Storage (SSR-safe) --------------------- */
const memoryStorage: Storage = {
  length: 0,
  clear: () => {},
  getItem: () => null,
  key: () => null,
  removeItem: () => {},
  setItem: () => {},
};

const storage: Storage =
  typeof window !== "undefined" && window.localStorage
    ? window.localStorage
    : memoryStorage;

/** Safe UUID for browser & SSR without any-casts */
const safeUUID = (): string => {
  const g = globalThis as unknown as { crypto?: { randomUUID?: () => string } };
  if (g.crypto?.randomUUID) return g.crypto.randomUUID();
  return `imotara-${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

/* --------------------------- Store ------------------------------- */
const initializer: StateCreator<EmotionHistoryState> = (set) => ({
  records: [],
  addRecord: (record: EmotionRecord) =>
    set((state) => ({ records: [...state.records, record] })),
  bulkAdd: (results: AnalysisResult[]) =>
    set((state) => ({
      records: [
        ...state.records,
        ...results.map((r) => ({
          id: safeUUID(),
          timestamp: Date.now(),
          emotion: coerceEmotion(r),
          intensity: coerceIntensity(r),
          summary: coerceSummary(r),
        })),
      ],
    })),
  clear: () => set({ records: [] }),
});

export const useEmotionHistory = create<EmotionHistoryState>()(
  persist(initializer, {
    name: "imotara-emotion-history",
    storage: createJSONStorage(() => storage),
  })
);
