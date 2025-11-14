// src/lib/imotara/pushLedger.ts
import type { EmotionRecord } from "@/types/history";

const LEDGER_KEY = "imotara.pushLedger"; // id -> lastPushedUpdatedAt (ms)

/**
 * Read the push ledger map from localStorage.
 */
export function getPushLedger(): Record<string, number> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(LEDGER_KEY);
    return raw ? (JSON.parse(raw) as Record<string, number>) : {};
  } catch {
    return {};
  }
}

/**
 * Persist the push ledger map.
 */
export function setPushLedger(ledger: Record<string, number>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LEDGER_KEY, JSON.stringify(ledger));
  } catch {
    // ignore write errors (private mode, quota, etc.)
  }
}

/**
 * Dev helper: clear the push ledger completely.
 * Safe to call from anywhere that wants to "start fresh".
 */
export function clearPushLedger() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(LEDGER_KEY);
  } catch {
    // ignore
  }
}

/**
 * Given local records, return the ones whose updatedAt is more recent than
 * the last time we successfully pushed them (as stored in the ledger).
 *
 * This is a pure helper – it does not mutate the ledger.
 */
export function computePending(records: EmotionRecord[]): EmotionRecord[] {
  // In SSR / non-browser contexts, we treat "pending" as empty so that
  // server code never miscounts pending items based on an empty ledger.
  if (typeof window === "undefined") return [];
  if (!Array.isArray(records) || records.length === 0) return [];

  const ledger = getPushLedger();

  return records.filter((r) => {
    const pushedAt = ledger[r.id] ?? 0;
    const updatedAt = r.updatedAt ?? r.createdAt ?? 0;
    return updatedAt > pushedAt;
  });
}

/**
 * After a successful push, mark accepted ids as pushed at their current
 * updatedAt (or createdAt if missing). This is the only place that *writes*
 * to the ledger, so all callers should use this after a successful push.
 */
export function markPushed(acceptedIds: string[], records: EmotionRecord[]) {
  if (!Array.isArray(acceptedIds) || acceptedIds.length === 0) return;
  if (!Array.isArray(records) || records.length === 0) return;

  const ledger = getPushLedger();
  const byId = new Map(records.map((r) => [r.id, r]));

  for (const id of acceptedIds) {
    const rec = byId.get(id);
    if (!rec) continue;
    ledger[id] = rec.updatedAt ?? rec.createdAt ?? Date.now();
  }

  setPushLedger(ledger);
}
