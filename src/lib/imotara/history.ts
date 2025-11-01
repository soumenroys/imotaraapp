// src/lib/imotara/history.ts
"use client";

import { v4 as uuid } from "uuid";
import type { EmotionSample, EmotionTag } from "@/types/history";
import type { Emotion } from "@/types/analysis";

const KEY = "imotara:history";

function readAll(): EmotionSample[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // basic shape guard
    return parsed.filter((x) => typeof x?.id === "string" && typeof x?.timestamp === "number");
  } catch {
    return [];
  }
}

function writeAll(items: EmotionSample[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(items));
}

export function saveSample(partial: Omit<EmotionSample, "id" | "timestamp"> & { timestamp?: number }) {
  const existing = readAll();
  const sample: EmotionSample = {
    id: uuid(),
    timestamp: partial.timestamp ?? Date.now(),
    text: partial.text,
    tags: partial.tags,
    source: partial.source,
    meta: partial.meta ?? {},
  };
  existing.push(sample);
  // keep only latest 5k to bound storage
  const trimmed = existing.sort((a, b) => a.timestamp - b.timestamp).slice(-5000);
  writeAll(trimmed);
  return sample;
}

export function getHistory(): EmotionSample[] {
  return readAll().sort((a, b) => b.timestamp - a.timestamp);
}

export function clearHistory() {
  writeAll([]);
}

export function getEmotionsSet(items: EmotionSample[]): Emotion[] {
  const set = new Set<Emotion>();
  items.forEach((s) => s.tags.forEach((t) => set.add(t.emotion)));
  return Array.from(set);
}

export function primaryTag(sample: EmotionSample): EmotionTag | undefined {
  return sample.tags?.[0];
}

// Aggregate points for chart: one point per message, primary emotion intensity
export function toChartSeries(
  items: EmotionSample[],
  focusEmotion?: Emotion | "all"
) {
  return items
    .slice()
    .sort((a, b) => a.timestamp - b.timestamp)
    .map((s) => {
      const p = primaryTag(s);
      const isMatch =
        !focusEmotion ||
        focusEmotion === "all" ||
        (p?.emotion && p.emotion === focusEmotion);
      return {
        t: s.timestamp,
        intensity: isMatch && p ? p.intensity : null,
        emotion: p?.emotion ?? null,
        source: s.source,
      };
    });
}
