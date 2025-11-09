// src/lib/imotara/summary.ts
import type { EmotionRecord, Emotion } from "@/types/history";

export type EmotionSummary = {
  total: number;
  avgIntensity: number; // 0..1
  dominantEmotion: Emotion | null;
  frequency: Record<Emotion, number>;
  last7dAvgIntensity: number; // 0..1
  last7dSeries: number[]; // length 7, per-day avg intensity (oldest -> newest)
};

/**
 * Compute high-level stats from emotion history.
 * Pure + deterministic; safe to call in SSR or client.
 */
export function computeEmotionSummary(
  history: EmotionRecord[],
  now: number = Date.now()
): EmotionSummary {
  const frequency = Object.create(null) as Record<Emotion, number>;

  let total = 0;
  let sumIntensity = 0;

  // initialize counters for known emotions to keep stable keys
  const allEmotions: Emotion[] = [
    "joy",
    "sadness",
    "anger",
    "fear",
    "disgust",
    "surprise",
    "neutral",
  ];
  for (const e of allEmotions) frequency[e] = 0;

  // --- Last 7 days setup (bucketed by local day) ---
  const MS_DAY = 24 * 60 * 60 * 1000;
  const dayStart = (t: number) => {
    const d = new Date(t);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  };
  const endDay = dayStart(now);         // today 00:00 local
  const startDay = endDay - 6 * MS_DAY; // 6 days before today (inclusive window = 7 days)
  const last7dCutoff = startDay;

  const daySums = new Array<number>(7).fill(0);
  const dayCounts = new Array<number>(7).fill(0);

  let last7dCount = 0;
  let last7dIntensitySum = 0;

  for (const rec of history ?? []) {
    const intensity = rec.intensity ?? 0;
    total += 1;
    sumIntensity += intensity;

    const e = rec.emotion as Emotion;
    if (e in frequency) {
      frequency[e] += 1;
    } else {
      (frequency as Record<string, number>)[e] =
        ((frequency as Record<string, number>)[e] ?? 0) + 1;
    }

    const t = rec.updatedAt ?? rec.createdAt ?? 0;

    // last 7 days aggregate
    if (t >= last7dCutoff) {
      last7dCount += 1;
      last7dIntensitySum += intensity;

      // bucket into 7 days (oldest..today)
      const bucket = Math.floor((dayStart(t) - startDay) / MS_DAY);
      if (bucket >= 0 && bucket < 7) {
        daySums[bucket] += intensity;
        dayCounts[bucket] += 1;
      }
    }
  }

  const avgIntensity = total ? clamp01(sumIntensity / total) : 0;
  const last7dAvgIntensity = last7dCount
    ? clamp01(last7dIntensitySum / last7dCount)
    : 0;

  // per-day average series (oldest -> newest)
  const last7dSeries = daySums.map((s, i) =>
    dayCounts[i] ? clamp01(s / dayCounts[i]) : 0
  );

  // dominant by frequency
  let dominantEmotion: Emotion | null = null;
  let bestCount = -1;
  for (const e of Object.keys(frequency) as Emotion[]) {
    const c = frequency[e] ?? 0;
    if (c > bestCount) {
      bestCount = c;
      dominantEmotion = e;
    }
  }
  if (!total) dominantEmotion = null;

  return {
    total,
    avgIntensity,
    dominantEmotion,
    frequency,
    last7dAvgIntensity,
    last7dSeries,
  };
}

function clamp01(n: number) {
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}
