// src/lib/imotara/history.ts
//
// Canonical local history accessors used by the app.
// - Client-only (safe on SSR: returns [] server-side)
// - Reads/writes from localStorage
// - Backward-compatible with BOTH keys:
//     "imotara:history:v1"  (preferred)
//     "imotara.history.v1"  (legacy)
//

"use client";

import { v4 as uuid } from "uuid";
import type { Emotion, EmotionRecord } from "@/types/history";

// Preferred key first; we also read legacy to stay compatible
const KEYS = ["imotara:history:v1", "imotara.history.v1"] as const;
type StorageKey = (typeof KEYS)[number];
const PRIMARY_KEY: StorageKey = KEYS[0];

// ---------------- internal helpers ----------------

function isClient() {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function safeParse(raw: string | null): EmotionRecord[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // basic shape guard
    return (parsed as unknown[]).filter(
      (x: any) =>
        typeof x?.id === "string" &&
        typeof x?.message === "string" &&
        typeof x?.emotion === "string" &&
        typeof x?.intensity === "number" &&
        typeof x?.createdAt === "number" &&
        typeof x?.updatedAt === "number"
    ) as EmotionRecord[];
  } catch {
    return [];
  }
}

function readFirstAvailable(): { key: StorageKey; list: EmotionRecord[] } {
  if (!isClient()) return { key: PRIMARY_KEY, list: [] };
  for (const k of KEYS) {
    const list = safeParse(localStorage.getItem(k));
    if (list.length) return { key: k, list };
  }
  // if none found, default to primary key
  return { key: PRIMARY_KEY, list: [] };
}

function writeAll(key: StorageKey, items: EmotionRecord[]) {
  if (!isClient()) return;
  try {
    localStorage.setItem(key, JSON.stringify(items));
  } catch {
    // ignore quota errors in dev
  }
}

// Normalize: newest-first
function sortNewest(list: EmotionRecord[]) {
  return list.slice().sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
}

// ---------------- public API ----------------

/** Get the entire emotion history (client: localStorage). Async for ergonomics. */
export async function getHistory(): Promise<EmotionRecord[]> {
  const { list } = readFirstAvailable();
  return sortNewest(list);
}

/** Synchronous getter (occasionally handy). */
export function getHistorySync(): EmotionRecord[] {
  const { list } = readFirstAvailable();
  return sortNewest(list);
}

/**
 * Replace the entire history array (writes to primary key).
 * Prefer patch/upsert for incremental updates.
 */
export async function setHistory(list: EmotionRecord[]): Promise<void> {
  writeAll(PRIMARY_KEY, sortNewest(list));
}

/** Append or replace by id (newer-wins by updatedAt). */
export async function upsertHistory(records: EmotionRecord[]): Promise<void> {
  const { key, list } = readFirstAvailable();
  const map = new Map<string, EmotionRecord>(list.map((r) => [r.id, r]));
  for (const r of records) {
    const prev = map.get(r.id);
    if (!prev) {
      map.set(r.id, r);
      continue;
    }
    // last-writer-wins via updatedAt
    const next =
      (r.updatedAt ?? 0) >= (prev.updatedAt ?? 0)
        ? { ...prev, ...r }
        : prev;
    map.set(r.id, next);
  }
  // bound storage to last 5000
  const nextList = sortNewest(Array.from(map.values())).slice(0, 5000);
  writeAll(key, nextList);
}

/** Remove a record by id (hard delete from local; elsewhere you may soft-delete). */
export async function removeFromHistory(id: string): Promise<void> {
  const { key, list } = readFirstAvailable();
  writeAll(
    key,
    list.filter((r) => r.id !== id)
  );
}

// ---------------- convenience + legacy-compatible helpers ----------------

/**
 * saveSample
 * Convenience for creating a single record quickly (used by dev seed).
 * Upserts using the same newer-wins rule.
 */
export async function saveSample(partial: {
  id?: string;
  message: string;
  emotion: Emotion;
  intensity: number; // 0..1
  source?: "local" | "remote" | "merged";
  createdAt?: number;
  updatedAt?: number;
  deleted?: boolean;
}) {
  const now = Date.now();
  const rec: EmotionRecord = {
    id: partial.id ?? uuid(),
    message: partial.message,
    emotion: partial.emotion,
    intensity: partial.intensity,
    createdAt: partial.createdAt ?? now,
    updatedAt: partial.updatedAt ?? now,
    source: partial.source ?? "local",
    deleted: partial.deleted ?? false,
  };
  await upsertHistory([rec]);
  return rec;
}

/** Unique set of emotions present in the given items. */
export function getEmotionsSet(items: EmotionRecord[]): Emotion[] {
  const set = new Set<Emotion>();
  items.forEach((r) => set.add(r.emotion));
  return Array.from(set);
}

/**
 * primaryTag
 * Compatibility helper for old code that expected a "primary tag".
 * For EmotionRecord, the "primary" is the (emotion, intensity) pair.
 */
export function primaryTag(
  sample: EmotionRecord
): { emotion: Emotion; intensity: number } | undefined {
  if (!sample) return undefined;
  return { emotion: sample.emotion, intensity: sample.intensity };
}

/**
 * Convert records to a chart-friendly series.
 * One point per record; filters by focusEmotion if provided.
 */
export function toChartSeries(
  items: EmotionRecord[],
  focusEmotion?: Emotion | "all"
) {
  return items
    .slice()
    .sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0))
    .map((r) => {
      const isMatch =
        !focusEmotion ||
        focusEmotion === "all" ||
        (r.emotion && r.emotion === focusEmotion);
      return {
        t: r.createdAt ?? r.updatedAt ?? Date.now(),
        intensity: isMatch ? r.intensity : null,
        emotion: r.emotion,
        source: r.source ?? "local",
      };
    });
}
