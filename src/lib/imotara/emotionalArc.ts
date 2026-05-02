// src/lib/imotara/emotionalArc.ts
// P5 — Emotional Arc Narrative: month/year-end written story of the user's
// emotional journey — not a chart, but a narrative with turning points.

"use client";

const LAST_ARC_KEY = "imotara.emotional_arc.last_at.v1";
const ARC_KEY = "imotara.emotional_arc.v1";
const INTERVAL_MS = 30 * 24 * 60 * 60 * 1000;

export type EmotionalArc = {
  id: string;
  generatedAt: number;
  periodLabel: string; // e.g. "April 2026"
  narrative: string;
};

function isClient() {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

export function loadStoredArc(): EmotionalArc | null {
  if (!isClient()) return null;
  try {
    const raw = localStorage.getItem(ARC_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveArc(arc: EmotionalArc): void {
  if (!isClient()) return;
  try {
    localStorage.setItem(ARC_KEY, JSON.stringify(arc));
    localStorage.setItem(LAST_ARC_KEY, String(arc.generatedAt));
  } catch {}
}

export function isArcDue(): boolean {
  if (!isClient()) return false;
  const raw = localStorage.getItem(LAST_ARC_KEY);
  if (!raw) return true;
  return Date.now() - Number(raw) >= INTERVAL_MS;
}

function buildArcContext(
  threads: Array<{ messages: Array<{ role: string; content: string; createdAt: number }> }>,
  cutoffMs = INTERVAL_MS
): { emotionProgression: string[]; milestones: string[]; threadCount: number } {
  const cutoff = Date.now() - cutoffMs;
  const positiveWords = ["better", "good", "happy", "grateful", "hopeful", "proud", "calm", "peace", "progress", "healed", "resolved"];
  const challengeWords = ["struggle", "hard", "difficult", "exhausted", "sad", "anxious", "overwhelmed", "lost", "confused", "hurt", "tired"];

  const milestones: string[] = [];
  let positiveShift = 0;
  let challengeStart = 0;
  let relevantThreads = 0;

  for (const thread of threads) {
    const recentMsgs = thread.messages.filter(
      (m) => m.role === "user" && m.createdAt >= cutoff
    );
    if (recentMsgs.length === 0) continue;
    relevantThreads++;

    const allText = recentMsgs.map((m) => m.content.toLowerCase()).join(" ");
    if (positiveWords.some((w) => allText.includes(w))) positiveShift++;
    if (challengeWords.some((w) => allText.includes(w))) challengeStart++;

    // Simple milestone detection
    if (/\b(finally|breakthrough|realized|figured out|made a decision|let go|accepted|forgave?)\b/i.test(allText)) {
      const snippet = recentMsgs[0].content.slice(0, 60).replace(/\n/g, " ");
      milestones.push(snippet);
    }
  }

  const progression: string[] = [];
  if (challengeStart > 1) progression.push("started the month carrying real weight");
  if (positiveShift > challengeStart) progression.push("moved toward something lighter");
  if (milestones.length > 0) progression.push("had at least one meaningful shift");

  return {
    emotionProgression: progression,
    milestones: milestones.slice(0, 3),
    threadCount: relevantThreads,
  };
}

export async function generateEmotionalArc(
  threads: Array<{ messages: Array<{ role: string; content: string; createdAt: number }> }>,
  userName: string
): Promise<EmotionalArc | null> {
  const { emotionProgression, milestones, threadCount } = buildArcContext(threads);
  const now = new Date();
  const periodLabel = now.toLocaleString("en", { month: "long", year: "numeric" });

  if (threadCount < 2) return null;

  const progressionText =
    emotionProgression.length > 0
      ? `The arc this month: ${emotionProgression.join(", ")}.`
      : "There was meaningful movement across several conversations this month.";

  const milestoneText =
    milestones.length > 0
      ? `Notable moments detected: "${milestones.join('"; "')}".`
      : "";

  const prompt = [
    `Write a short personal narrative (not a list, not bullet points — a flowing story) about ${userName}'s emotional journey this month (${periodLabel}).`,
    progressionText,
    milestoneText,
    `Use second person ("You started...", "By mid-month..."). Include: how the month opened emotionally, any turning points or shifts you detected, something the user should be proud of, and a closing line that looks forward.`,
    `Tone: intimate, honest, hopeful. 3 paragraphs max. No headers. No emojis.`,
  ].join(" ");

  try {
    const res = await fetch("/api/respond", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: prompt,
        sessionId: "emotional-arc",
        isArcMode: true,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const narrative: string = data.reply ?? data.message ?? "";
    if (!narrative.trim()) return null;

    const arc: EmotionalArc = {
      id: `arc-${Date.now()}`,
      generatedAt: Date.now(),
      periodLabel,
      narrative: narrative.trim(),
    };
    saveArc(arc);
    return arc;
  } catch {
    return null;
  }
}
