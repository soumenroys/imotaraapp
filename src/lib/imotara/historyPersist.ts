// src/lib/imotara/historyPersist.ts
import type { EmotionRecord } from "@/types/history";

const STORAGE_KEY = "imotara.history";

/**
 * Persist the full history to localStorage.
 * Safe to call after merges or edits.
 */
export function saveHistory(records: EmotionRecord[]): void {
  try {
    const payload = JSON.stringify(records ?? []);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, payload);
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[historyPersist] saveHistory failed:", err);
  }
}
