// src/lib/imotara/yearInReview.ts
// NF-4 — Emotional Year in Review: a personal narrative of the user's
// emotional journey across a full year. Generated once per year, cached.

"use client";

const REVIEW_KEY_PREFIX = "imotara.year_review.v1";

export type YearReview = {
  id: string;
  year: number;
  generatedAt: number;
  totalMessages: number;
  dominantEmotion: string;
  peakMonth: string;
  narrative: string;
};

function isClient() {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

// The year being reviewed: current year in December, previous year otherwise.
export function reviewYear(): number {
  const now = new Date();
  return now.getMonth() === 11 ? now.getFullYear() : now.getFullYear() - 1;
}

function reviewKey(year: number) {
  return `${REVIEW_KEY_PREFIX}.${year}`;
}

export function loadStoredYearReview(year?: number): YearReview | null {
  if (!isClient()) return null;
  const y = year ?? reviewYear();
  try {
    const raw = localStorage.getItem(reviewKey(y));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveYearReview(review: YearReview): void {
  if (!isClient()) return;
  try {
    localStorage.setItem(reviewKey(review.year), JSON.stringify(review));
  } catch {}
}

function buildYearContext(year: number): {
  totalMessages: number;
  dominantEmotion: string;
  peakMonth: string;
  progressionLines: string[];
  milestones: string[];
} | null {
  if (!isClient()) return null;
  try {
    const raw = localStorage.getItem("imotara:history:v1");
    if (!raw) return null;
    const all = JSON.parse(raw) as any[];
    if (!Array.isArray(all)) return null;

    const yearStart = new Date(year, 0, 1).getTime();
    const yearEnd = new Date(year + 1, 0, 1).getTime();
    const yearMsgs = all.filter(
      (r) => !r.deleted && r.createdAt >= yearStart && r.createdAt < yearEnd,
    );
    if (yearMsgs.length < 30) return null;

    const monthly: Record<number, number> = {};
    const emotionFreq: Record<string, number> = {};
    const positiveWords = ["better","good","happy","grateful","hopeful","proud","calm","peace","progress","healed","resolved","excited","relieved","stronger"];
    const challengeWords = ["struggle","hard","difficult","exhausted","sad","anxious","overwhelmed","lost","confused","hurt","tired","lonely","grief","stuck"];
    const milestones: string[] = [];
    const qCounts = [0, 0, 0, 0];
    const qPositive = [0, 0, 0, 0];
    const qChallenge = [0, 0, 0, 0];

    for (const r of yearMsgs) {
      const month = new Date(r.createdAt).getMonth();
      const q = Math.floor(month / 3);
      monthly[month] = (monthly[month] ?? 0) + 1;
      qCounts[q]++;

      if (r.emotion && r.emotion !== "neutral") {
        emotionFreq[r.emotion] = (emotionFreq[r.emotion] ?? 0) + 1;
      }

      const lower = String(r.text ?? "").toLowerCase();
      if (positiveWords.some((w) => lower.includes(w))) qPositive[q]++;
      if (challengeWords.some((w) => lower.includes(w))) qChallenge[q]++;

      if (
        /\b(finally|breakthrough|realized|figured out|let go|accepted|forgave?|healed|moved on)\b/i
          .test(r.text ?? "")
      ) {
        milestones.push(String(r.text ?? "").slice(0, 80).replace(/\n/g, " ").trim());
      }
    }

    const dominantEmotion =
      Object.entries(emotionFreq).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "reflective";

    const peakMonthNum = Object.entries(monthly)
      .sort((a, b) => b[1] - a[1])[0]?.[0];
    const peakMonth =
      peakMonthNum != null
        ? new Date(year, Number(peakMonthNum), 1).toLocaleString("en", { month: "long" })
        : "several months";

    const quarterLabels = [
      "early in the year",
      "mid-year",
      "as the year progressed",
      "toward year's end",
    ];
    const progressionLines: string[] = [];
    for (let q = 0; q < 4; q++) {
      if (qCounts[q] === 0) continue;
      const total = qPositive[q] + qChallenge[q];
      const ratio = total > 0 ? qChallenge[q] / total : 0.5;
      if (ratio > 0.6) progressionLines.push(`carried real weight ${quarterLabels[q]}`);
      else if (ratio < 0.35) progressionLines.push(`found lighter ground ${quarterLabels[q]}`);
    }

    return {
      totalMessages: yearMsgs.length,
      dominantEmotion,
      peakMonth,
      progressionLines,
      milestones: milestones.slice(0, 4),
    };
  } catch {
    return null;
  }
}

export async function generateYearReview(
  userName: string,
  year?: number,
): Promise<YearReview | null> {
  const y = year ?? reviewYear();
  const ctx = buildYearContext(y);
  if (!ctx) return null;

  const { totalMessages, dominantEmotion, peakMonth, progressionLines, milestones } = ctx;

  const progressionText =
    progressionLines.length > 0
      ? `Emotional arc: ${progressionLines.join("; ")}.`
      : "You showed up consistently across the year.";

  const milestoneText =
    milestones.length > 0
      ? `Moments of shift detected: "${milestones.join('"; "')}".`
      : "";

  const prompt = [
    `Write a warm, personal Year in Review narrative for ${userName}'s emotional journey across ${y}.`,
    `They had ${totalMessages} conversations. Their most common emotional tone was ${dominantEmotion}. Their most active month was ${peakMonth}.`,
    progressionText,
    milestoneText,
    `Write in second person ("This year, you..."). Exactly 4 paragraphs:`,
    `1. How the year opened emotionally and what themes appeared early.`,
    `2. The patterns and recurring threads that ran through the year.`,
    `3. The hardest stretch — and what carried them through it.`,
    `4. A warm, proud, forward-looking close for the year ahead.`,
    `Tone: intimate, honest, celebratory. No headers. No bullet points. No emojis.`,
  ].join(" ");

  try {
    const res = await fetch("/api/respond", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: prompt,
        sessionId: `year-review-${y}`,
        isYearReviewMode: true,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const narrative: string = data.reply ?? data.message ?? "";
    if (!narrative.trim()) return null;

    const review: YearReview = {
      id: `year-review-${y}-${Date.now()}`,
      year: y,
      generatedAt: Date.now(),
      totalMessages,
      dominantEmotion,
      peakMonth,
      narrative: narrative.trim(),
    };
    saveYearReview(review);
    return review;
  } catch {
    return null;
  }
}
