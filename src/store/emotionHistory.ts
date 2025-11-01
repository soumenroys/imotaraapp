// src/store/emotionHistory.ts
import { create, StateCreator } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Emotion, AnalysisResult } from "@/types/analysis";

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

// ---- Helpers: tolerant extraction from unknown AnalysisResult shapes ----
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
  typeof v === "string" && (EMOTIONS as string[]).includes(v);

const coerceEmotion = (src: any): Emotion => {
  // Try common locations/names for the dominant emotion
  const candidates: unknown[] = [
    src?.overall?.emotion,
    src?.overall?.dominantEmotion,
    src?.dominantEmotion,
    src?.emotion,
    src?.tag?.emotion,
    src?.summary?.dominant?.emotion,
    src?.summary?.emotion,
  ];
  for (const c of candidates) {
    if (isEmotion(c)) return c;
  }
  return "neutral";
};

const coerceIntensity = (src: any): number => {
  // Normalize intensity into [0,1] if value provided in [0,100]
  const candidates: unknown[] = [
    src?.overall?.intensity,
    src?.intensity,
    src?.score,
    src?.overall?.confidence,
    src?.confidence,
  ];

  for (const c of candidates) {
    if (typeof c === "number" && Number.isFinite(c)) {
      if (c > 1) return Math.max(0, Math.min(1, c / 100)); // assume percentage
      if (c < 0) return 0;
      return c;
    }
  }
  return 0.5; // reasonable default
};

const coerceSummary = (src: any): string | undefined => {
  const s = src?.summary;

  if (s == null) return undefined;

  if (typeof s === "string") return s;

  // Common object shapes: { text }, { note }, { overview }, { sentences: [...] }, etc.
  if (typeof s === "object") {
    const textLike =
      (typeof s.text === "string" && s.text) ||
      (typeof s.note === "string" && s.note) ||
      (typeof s.overview === "string" && s.overview) ||
      (Array.isArray(s.sentences) && s.sentences.filter((x: unknown) => typeof x === "string").join(" ")) ||
      (typeof s.brief === "string" && s.brief);

    if (textLike) return String(textLike).slice(0, 500); // avoid oversized localStorage entries

    // last resort: very compact JSON preview
    try {
      const json = JSON.stringify(s);
      return json.length > 500 ? json.slice(0, 497) + "..." : json;
    } catch {
      return undefined;
    }
  }

  return undefined;
};

// ---- SSR-safe localStorage shim (Next.js App Router friendly) ----
const storage: Storage =
  typeof window !== "undefined"
    ? window.localStorage
    : ({
        getItem: () => null,
        setItem: () => {},
        removeItem: () => {},
      } as unknown as Storage);

// Safe UUID for both browser and SSR
const safeUUID = (): string =>
  (globalThis as any)?.crypto?.randomUUID?.() ??
  `imotara-${Date.now()}-${Math.random().toString(36).slice(2)}`;

// ---- Store ----
const initializer: StateCreator<EmotionHistoryState> = (set) => ({
  records: [],
  addRecord: (record: EmotionRecord) =>
    set((state) => ({
      records: [...state.records, record],
    })),
  bulkAdd: (results: AnalysisResult[]) =>
    set((state) => ({
      records: [
        ...state.records,
        ...results.map((r) => ({
          id: safeUUID(),
          timestamp: Date.now(),
          emotion: coerceEmotion(r as any),
          intensity: coerceIntensity(r as any),
          summary: coerceSummary(r as any),
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
