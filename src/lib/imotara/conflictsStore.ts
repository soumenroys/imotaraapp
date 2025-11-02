// src/lib/imotara/conflictsStore.ts
"use client";

import type { ConflictList } from "@/types/sync";

const KEY = "imotara.history.conflicts";

/* ----------------------------- JSON helpers ----------------------------- */
function readConflicts(): ConflictList {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as ConflictList) : [];
  } catch {
    return [];
  }
}

function writeConflicts(list: ConflictList): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(list));
}

/* ----------------------------- Public API ------------------------------- */
export function getPendingConflicts(): ConflictList {
  return readConflicts();
}

export function setPendingConflicts(list: ConflictList): void {
  writeConflicts(list);
}

export function upsertConflicts(newOnes: ConflictList): void {
  const existing = readConflicts();
  const byId = new Map<string, (ConflictList[number])>(
    existing.map((c) => [c.id, c])
  );
  for (const c of newOnes) byId.set(c.id, c);
  writeConflicts(Array.from(byId.values()));
}

export function removeConflict(conflictId: string): void {
  const filtered = readConflicts().filter((c) => c.id !== conflictId);
  writeConflicts(filtered);
}

export function clearAllConflicts(): void {
  writeConflicts([]);
}

/** Count unresolved conflicts; SSR-safe (returns 0 on server). */
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
