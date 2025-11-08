// src/lib/imotara/historyPersist.ts
import type { EmotionRecord } from "@/types/history";
import type { SyncState } from "@/types/sync";

const STORAGE_KEY = "imotara.history";
const SYNC_STATE_KEY = "imotara.syncState.v1";

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

/**
 * Read all stored history records from localStorage.
 * (Optional helper if you don’t already have one elsewhere.)
 */
export function getHistory(): EmotionRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as EmotionRecord[];
  } catch {
    return [];
  }
}

/**
 * ---- Sync state persistence ----
 * Keeps shadow + token between sessions for incremental sync.
 */

/** Read the sync state (shadow + token). Safe on server too. */
export function getSyncState(): SyncState {
  if (typeof window === "undefined") {
    return { shadow: {}, syncToken: null, lastSyncedAt: null };
  }
  try {
    const raw = window.localStorage.getItem(SYNC_STATE_KEY);
    if (!raw) return { shadow: {}, syncToken: null, lastSyncedAt: null };
    const parsed = JSON.parse(raw) as Partial<SyncState>;
    return {
      shadow: parsed.shadow ?? {},
      syncToken: parsed.syncToken ?? null,
      lastSyncedAt: parsed.lastSyncedAt ?? null,
    };
  } catch {
    return { shadow: {}, syncToken: null, lastSyncedAt: null };
  }
}

/** Write the sync state. */
export function saveSyncState(next: SyncState): void {
  if (typeof window === "undefined") return;
  const compact: SyncState = {
    shadow: next.shadow ?? {},
    syncToken: next.syncToken ?? null,
    lastSyncedAt: next.lastSyncedAt ?? Date.now(),
  };
  window.localStorage.setItem(SYNC_STATE_KEY, JSON.stringify(compact));
}
