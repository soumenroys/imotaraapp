// src/hooks/useApplyChoice.ts
//
// Minimal hook that wraps the pure applyChoice() helper.
// This step is *stateless* — it just returns the updated record.
// We'll wire persistence/sync in the next baby step.

"use client";

import { useCallback } from "react";
import type { EmotionRecord } from "@/types/history";
import type { Choice } from "@/types/choice";
import { applyChoice } from "@/lib/imotara/choices";

export function useApplyChoice() {
  /**
   * Apply a choice to a given record and return a NEW updated record.
   * No persistence is done here; caller decides what to do with the result.
   */
  const apply = useCallback(
    (record: EmotionRecord, choice: Choice): EmotionRecord => {
      // This runs on the client after user click, so using Date.now() is fine.
      // We pass it into applyChoice for deterministic updates.
      const now = Date.now();
      return applyChoice(record, choice, { now });
    },
    []
  );

  return { apply };
}
