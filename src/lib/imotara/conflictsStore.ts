// src/lib/imotara/conflictsStore.ts
"use client";

import type { ConflictList, HistoryConflict } from "@/types/sync";

const KEY = "imotara.history.conflicts";

export function getPendingConflicts(): ConflictList {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as ConflictList) : [];
  } catch {
    return [];
  }
}

export function setPendingConflicts(list: ConflictList) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(list));
}

export function upsertConflicts(newOnes: ConflictList) {
  const existing = getPendingConflicts();
  const byId = new Map(existing.map((c) => [c.id, c]));
  for (const c of newOnes) byId.set(c.id, c);
  setPendingConflicts(Array.from(byId.values()));
}

export function removeConflict(conflictId: string) {
  const filtered = getPendingConflicts().filter((c) => c.id !== conflictId);
  setPendingConflicts(filtered);
}

export function clearAllConflicts() {
  setPendingConflicts([]);
}

export function useConflictsCount(): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return 0;
    const arr = JSON.parse(raw) as ConflictList;
    return arr.filter((c) => !c.resolution).length;
  } catch {
    return 0;
  }
}
