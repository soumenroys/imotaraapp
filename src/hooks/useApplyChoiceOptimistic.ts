// src/hooks/useApplyChoiceOptimistic.ts
//
// Applies a Choice to a record (pure) and then persists it locally (optimistic).
// No toasts/UI here — just the data operation. Caller can show UI feedback.

"use client";

import { useCallback } from "react";
import type { EmotionRecord } from "@/types/history";
import type { Choice } from "@/types/choice";
import { applyChoice } from "@/lib/imotara/choices";
import { patchHistoryItem } from "@/lib/imotara/patchHistory";

// compute a minimal patch between two EmotionRecords
function diffRecord(prev: EmotionRecord, next: EmotionRecord): Partial<EmotionRecord> {
  const patch: Partial<EmotionRecord> = {};

  if (prev.emotion !== next.emotion) patch.emotion = next.emotion;
  if (prev.intensity !== next.intensity) patch.intensity = next.intensity;

  const prevTags = JSON.stringify(prev.topicTags ?? []);
  const nextTags = JSON.stringify(next.topicTags ?? []);
  if (prevTags !== nextTags) patch.topicTags = next.topicTags;

  if ((prev.important ?? false) !== (next.important ?? false)) patch.important = next.important;

  const prevFU = JSON.stringify(prev.followUps ?? []);
  const nextFU = JSON.stringify(next.followUps ?? []);
  if (prevFU !== nextFU) patch.followUps = next.followUps;

  const prevApplied = JSON.stringify(prev.appliedChoices ?? []);
  const nextApplied = JSON.stringify(next.appliedChoices ?? []);
  if (prevApplied !== nextApplied) patch.appliedChoices = next.appliedChoices;

  const prevHist = JSON.stringify(prev._appliedChoiceHistory ?? []);
  const nextHist = JSON.stringify(next._appliedChoiceHistory ?? []);
  if (prevHist !== nextHist) patch._appliedChoiceHistory = next._appliedChoiceHistory;

  // updatedAt will be bumped in patchHistoryItem; we still include next.updatedAt
  // if applyChoice provided one (for determinism). patchHistoryItem ensures monotonic.
  if (typeof next.updatedAt === "number") patch.updatedAt = next.updatedAt;

  return patch;
}

export function useApplyChoiceOptimistic() {
  /**
   * Apply a choice and persist it to local history (optimistic).
   * Returns the saved record (or null on failure).
   */
  const applyAndSave = useCallback(
    async (record: EmotionRecord, choice: Choice): Promise<EmotionRecord | null> => {
      const now = Date.now();
      const next = applyChoice(record, choice, { now });
      const patch = diffRecord(record, next);
      try {
        return await patchHistoryItem(record.id, patch);
      } catch {
        return null;
      }
    },
    []
  );

  return { applyAndSave };
}
