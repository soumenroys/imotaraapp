// src/types/sync.ts
import type { EmotionRecord } from "@/types/history";

export type ConflictReason =
  | "newer-remote"
  | "newer-local"
  | "same-updatedAt-diff-content"
  | "duplicate-id";

export interface HistoryConflict {
  id: string;               // stable conflict id
  recordId: string;         // EmotionRecord.id that's in conflict
  reason: ConflictReason;
  local?: EmotionRecord | null;
  remote?: EmotionRecord | null;
  createdAt: number;        // when we detected the conflict
  resolvedAt?: number;      // when user resolved it
  resolution?: "kept-local" | "kept-remote" | "merged";
  mergedRecord?: EmotionRecord; // if resolution === "merged"
}

export type ConflictList = HistoryConflict[];
