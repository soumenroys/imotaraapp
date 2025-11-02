// src/lib/imotara/pushLedger.ts
import type { EmotionRecord } from "@/types/history";

const LEDGER_KEY = "imotara.pushLedger"; // id -> lastPushedUpdatedAt (ms)

/** Read the push ledger map from localStorage. */
export function getPushLedger(): Record<string, number> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(LEDGER_KEY);
    return raw ? (JSON.parse(raw) as Record<string, number>) : {};
  } catch {
    return {};
  }
}

/** Persist the push ledger map. */
export function setPushLedger(ledger: Record<string, number>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LEDGER_KEY, JSON.stringify(ledger));
  } catch {
    // ignore
  }
}

/** Given local records, return the ones whose updatedAt is more recent than ledger. */
export function computePending(records: EmotionRecord[]): EmotionRecord[] {
  const ledger = getPushLedger();
  return records.filter((r) => {
    const pushedAt = ledger[r.id] ?? 0;
    const updatedAt = r.updatedAt ?? r.createdAt ?? 0;
    return updatedAt > pushedAt;
  });
}

/** After a successful push, mark accepted ids as pushed at their current updatedAt. */
export function markPushed(acceptedIds: string[], records: EmotionRecord[]) {
  if (acceptedIds.length === 0) return;
  const ledger = getPushLedger();
  const byId = new Map(records.map((r) => [r.id, r]));
  for (const id of acceptedIds) {
    const rec = byId.get(id);
    if (!rec) continue;
    ledger[id] = rec.updatedAt ?? rec.createdAt ?? Date.now();
  }
  setPushLedger(ledger);
}
