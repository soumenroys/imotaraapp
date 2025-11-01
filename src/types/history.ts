// src/types/history.ts
import type { Emotion } from "@/types/analysis";

export type AnalysisSource = "local" | "remote";

export type EmotionTag = {
  emotion: Emotion;
  intensity: number; // 0..1
};

export type EmotionSample = {
  id: string;                 // uuid
  timestamp: number;          // ms epoch
  text: string;               // original user message (or summary)
  tags: EmotionTag[];         // one or more tags (primary first)
  source: AnalysisSource;     // "local" | "remote"
  meta?: Record<string, any>; // optional extra
};
