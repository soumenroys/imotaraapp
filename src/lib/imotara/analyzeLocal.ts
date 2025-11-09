// src/lib/imotara/analyzeLocal.ts
import type {
  AnalyzeLocal,
  AnalysisInput,
  AnalysisResult,
  PerMessageAnalysis,
  Emotion,
  EmotionTag,
  MoodSnapshot,
  Reflection,
} from "@/types/analysis";

// --- 1) Tiny word lists for a first-pass heuristic (local-only) ---
const LEXICON: Record<Emotion, string[]> = {
  joy: [
    "happy","glad","joy","delighted","great","awesome","love","loved","grateful",
    "excited","relieved","proud","peaceful","calm","satisfied","content",
  ],
  sadness: [
    "sad","down","unhappy","depressed","lonely","cry","crying","upset","hurt",
    "disappointed","gloomy","heartbroken","miserable",
  ],
  anger: [
    "angry","mad","furious","annoyed","frustrated","irritated","rage","enraged",
    "pissed","resent","hate","hated",
  ],
  fear: [
    "afraid","scared","fear","anxious","anxiety","worried","worry","nervous",
    "terrified","panic","panicking","uncertain",
  ],
  disgust: [
    "disgust","gross","revolting","nauseated","repulsed","sickened","yuck","ew",
  ],
  surprise: [
    "surprised","shocked","wow","unexpected","amazed","astonished","suddenly",
  ],
  neutral: [
    // intentionally empty; used as fallback
  ],
};

// Polarity weights for a quick -1..1 estimate
const POLARITY_WEIGHT: Record<Emotion, number> = {
  joy: +1,
  surprise: 0.1,
  neutral: 0,
  sadness: -1,
  anger: -0.9,
  fear: -0.8,
  disgust: -0.9,
};

// --- 2) Helpers ---
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s']/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function scoreEmotion(tokens: string[], words: string[]): number {
  if (!words.length) return 0;
  let hits = 0;
  const set = new Set(tokens);
  for (const w of words) if (set.has(w)) hits++;
  // Convert hits -> intensity in 0..1 with a soft cap
  const raw = hits / Math.max(3, words.length * 0.2); // small list = still reachable
  return Math.max(0, Math.min(1, raw));
}

function normalizeAll(scores: Partial<Record<Emotion, number>>): EmotionTag[] {
  // take given scores, normalize to 0..1 (max-normalization), drop near-zero
  let max = 0;
  for (const k in scores) max = Math.max(max, scores[k as Emotion] || 0);
  if (max <= 0) return [];
  const tags: EmotionTag[] = [];
  (Object.keys(scores) as Emotion[]).forEach((e) => {
    const v = (scores[e] || 0) / max;
    if (v > 0.05) {
      tags.push({ emotion: e, intensity: Number(v.toFixed(3)), source: "local" });
    }
  });
  return tags.sort((a, b) => b.intensity - a.intensity);
}

function dominantFromTags(tags: EmotionTag[]): EmotionTag {
  if (tags.length === 0) return { emotion: "neutral", intensity: 0, source: "local" };
  return tags[0];
}

function computePolarity(tags: EmotionTag[]): number {
  if (!tags.length) return 0;
  let sum = 0;
  let wsum = 0;
  for (const t of tags) {
    const w = Math.max(0.1, t.intensity);
    sum += (POLARITY_WEIGHT[t.emotion] ?? 0) * w;
    wsum += w;
  }
  const p = sum / (wsum || 1);
  // clamp to -1..1
  return Number(Math.max(-1, Math.min(1, p)).toFixed(3));
}

function summarize(dominant: Emotion, polarity: number): string {
  if (dominant === "joy") return "Mostly positive with moments of ease";
  if (dominant === "surprise") return "Curious, with a few unexpected turns";
  if (dominant === "neutral") {
    if (polarity > 0.2) return "Calm with a gentle positive tone";
    if (polarity < -0.2) return "Calm with a slightly heavy tone";
    return "Even and steady overall";
  }
  if (dominant === "sadness") return "A heavier tone lately";
  if (dominant === "anger") return "Irritation and pushback are noticeable";
  if (dominant === "fear") return "Worry and uncertainty are present";
  if (dominant === "disgust") return "Aversion shows up in places";
  return "Mixed feelings overall";
}

function oneLineDetail(delta: number): string | undefined {
  if (delta > 0.1) return "Positivity trended up recently.";
  if (delta < -0.1) return "Positivity dipped a bit recently.";
  return undefined;
}

function windowOf(inputs: AnalysisInput[], size: number) {
  const slice = inputs.slice(-size);
  const now = Date.now();
  // Prefer provided timestamps; fall back to now to avoid SSR/Hydration drift
  const from = slice[0]?.createdAt ?? now;
  const to = slice[slice.length - 1]?.createdAt ?? now;
  return { slice, from, to };
}

// --- 3) Per-message analysis ---
function analyzeMessage(msg: AnalysisInput): PerMessageAnalysis {
  const raw = (msg.message ?? msg.text ?? "").trim();
  const tokens = tokenize(raw);

  const rawScores: Partial<Record<Emotion, number>> = {};
  (Object.keys(LEXICON) as Emotion[]).forEach((e) => {
    if (e === "neutral") return;
    rawScores[e] = scoreEmotion(tokens, LEXICON[e]);
  });

  // If everything is zero, mark neutral = small baseline
  const allTags = normalizeAll(rawScores);
  if (allTags.length === 0) {
    allTags.push({ emotion: "neutral", intensity: 0.2, source: "local" });
  }

  const dominant = dominantFromTags(allTags);
  const polarity = computePolarity(allTags);

  return {
    id: msg.id,
    dominant,
    all: allTags,
    heuristics: { polarity },

    // Back-compat minimal fields
    emotion: dominant.emotion,
    intensity: dominant.intensity,
    explanation: dominant.emotion === "neutral"
      ? "No strong affective keywords detected."
      : `Keywords aligned with ${dominant.emotion}.`,
  };
}

// --- 4) Aggregate snapshot over the last N messages ---
function buildSnapshot(perMsg: PerMessageAnalysis[], from: number, to: number): MoodSnapshot {
  const acc: Partial<Record<Emotion, { sum: number; n: number }>> = {};
  for (const p of perMsg) {
    for (const tag of p.all) {
      if (!acc[tag.emotion]) acc[tag.emotion] = { sum: 0, n: 0 };
      acc[tag.emotion]!.sum += tag.intensity;
      acc[tag.emotion]!.n += 1;
    }
  }
  const averages: Partial<Record<Emotion, number>> = {};
  (Object.keys(acc) as Emotion[]).forEach((e) => {
    const { sum, n } = acc[e]!;
    averages[e] = Number((sum / Math.max(1, n)).toFixed(3));
  });

  // pick dominant by highest average
  let dominant: Emotion = "neutral";
  let best = -1;
  for (const e of Object.keys(averages) as Emotion[]) {
    const v = averages[e] ?? 0;
    if (v > best) {
      best = v;
      dominant = e;
    }
  }
  if (best <= 0) dominant = "neutral";

  return { window: { from, to }, averages, dominant };
}

// --- 5) Simple reflection generator ---
function buildReflections(perMsg: PerMessageAnalysis[]): Reflection[] {
  if (perMsg.length === 0) return [];
  const last = perMsg[perMsg.length - 1];

  const lines: string[] = [];
  const d = last.dominant.emotion;

  if (d === "joy") lines.push("You sounded lighter and more at ease in the latest message.");
  if (d === "sadness") lines.push("There’s a heavier tone lately—acknowledging it can help.");
  if (d === "anger") lines.push("I noticed irritation; taking a short pause might help reset.");
  if (d === "fear") lines.push("There’s some worry—naming the specific concern could reduce it.");
  if (d === "disgust") lines.push("Some aversion appeared—clarifying boundaries may help.");
  if (d === "surprise") lines.push("Something unexpected came up—capturing the takeaway could help.");
  if (d === "neutral") lines.push("A steady, even tone recently—small wins are worth noting.");

  // Add a polarity hint if strong
  const pol = last.heuristics?.polarity ?? 0;
  if (pol > 0.6) lines.push("Overall positivity feels strong; perhaps note what supported it.");
  if (pol < -0.6) lines.push("Tone is quite heavy; a brief grounding exercise could help.");

  return [
    {
      text: lines.join(" "),
      createdAt: Date.now(),
      relatedIds: [last.id],
    },
  ];
}

// --- 6) Public API: analyzeLocal ---
export const analyzeLocal: AnalyzeLocal = async (inputs, options) => {
  const windowSize = Math.max(1, options?.windowSize ?? 10);
  const { slice, from, to } = windowOf(inputs, windowSize);

  // Per-message pass
  const perMessage = slice.map(analyzeMessage);

  // Snapshot over window
  const snapshot = buildSnapshot(perMessage, from, to);

  // Summary lines
  const avgPolarity =
    perMessage.reduce((s, p) => s + (p.heuristics?.polarity ?? 0), 0) /
    Math.max(1, perMessage.length);

  const headline = summarize(snapshot.dominant, avgPolarity);
  const details = oneLineDetail(avgPolarity);

  // Reflections
  const reflections = buildReflections(perMessage);

  const computedAt = Date.now();

  const result: AnalysisResult = {
    perMessage,
    snapshot,
    summary: { headline, details },
    reflections,
    computedAt,
    // Back-compat mirrors for simpler consumers
    timestamp: computedAt,
    items: perMessage.map((p) => ({
      id: p.id,
      emotion: p.emotion ?? p.dominant.emotion,
      intensity: p.intensity ?? p.dominant.intensity,
      explanation: p.explanation,
    })),
  };

  return result;
};
