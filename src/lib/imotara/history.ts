// src/lib/imotara/history.ts
"use client";

import { v4 as uuid } from "uuid";
import type { Emotion, EmotionRecord } from "@/types/history";

// Keep storage consistent with sync manager
const KEY = "imotara.history.v1";

/** Read entire local history from localStorage (safe parse). */
function readAll(): EmotionRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // basic shape guard
    return parsed.filter(
      (x) =>
        typeof x?.id === "string" &&
        typeof x?.message === "string" &&
        typeof x?.emotion === "string" &&
        typeof x?.intensity === "number" &&
        typeof x?.createdAt === "number" &&
        typeof x?.updatedAt === "number"
    );
  } catch {
    return [];
  }
}

/** Write entire local history to localStorage. */
function writeAll(items: EmotionRecord[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(items));
}

/**
 * saveSample
 * Create (or upsert) a single record in local history.
 * This replaces the old EmotionSample-based API with EmotionRecord.
 */
export function saveSample(partial: {
  id?: string;
  message: string;
  emotion: Emotion;
  intensity: number; // 0..1
  source?: "local" | "remote" | "merged";
  createdAt?: number;
  updatedAt?: number;
  deleted?: boolean;
}) {
  const existing = readAll();
  const now = Date.now();

  const record: EmotionRecord = {
    id: partial.id ?? uuid(),
    message: partial.message,
    emotion: partial.emotion,
    intensity: partial.intensity,
    createdAt: partial.createdAt ?? now,
    updatedAt: partial.updatedAt ?? now,
    source: partial.source ?? "local",
    deleted: partial.deleted ?? false,
  };

  // upsert by id (replace if exists)
  const idx = existing.findIndex((r) => r.id === record.id);
  if (idx >= 0) {
    // last-writer-wins by updatedAt
    const prev = existing[idx];
    existing[idx] =
      (record.updatedAt ?? 0) >= (prev.updatedAt ?? 0) ? record : prev;
  } else {
    existing.push(record);
  }

  // keep only latest 5k by updatedAt to bound storage
  const trimmed = existing
    .slice()
    .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))
    .slice(0, 5000);

  writeAll(trimmed);
  return record;
}

/** Return local history newest-first. */
export function getHistory(): EmotionRecord[] {
  return readAll().sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
}

/** Clear all local history. */
export function clearHistory() {
  writeAll([]);
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
 * For EmotionRecord, the "primary" is just the (emotion, intensity) pair.
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
