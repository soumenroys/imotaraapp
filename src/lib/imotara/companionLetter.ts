// src/lib/imotara/companionLetter.ts
// P3 — Companion's Letter to You: once a month, Imotara writes a personal
// letter to the user reflecting on what it noticed, admired, and hopes for them.

"use client";

import type { ImotaraProfileV1 } from "./profile";

const LAST_LETTER_KEY   = "imotara.companion_letter.last_at.v1";
const LETTER_ARCHIVE_KEY = "imotara.companion_letters.archive.v1"; // array of letters
const LETTER_CADENCE_KEY = "imotara.letter.cadenceDays.v1";
const DEFAULT_INTERVAL_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_ARCHIVE_SIZE = 24; // keep up to 24 letters (~2 years at monthly)

function getIntervalMs(): number {
  try {
    if (!isClient()) return DEFAULT_INTERVAL_MS;
    const days = parseInt(localStorage.getItem(LETTER_CADENCE_KEY) ?? "30", 10);
    return isFinite(days) && days > 0 ? days * 24 * 60 * 60 * 1000 : DEFAULT_INTERVAL_MS;
  } catch {
    return DEFAULT_INTERVAL_MS;
  }
}

export type CompanionLetter = {
  id: string;
  generatedAt: number;
  body: string;
  companionName: string;
  // User interactions
  reaction?: string;   // emoji the user placed on this letter
  reply?: string;      // user's written reply to the letter
  replyAt?: number;    // timestamp when the reply was written
};

function isClient() {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

export function loadLetterArchive(): CompanionLetter[] {
  if (!isClient()) return [];
  try {
    const raw = localStorage.getItem(LETTER_ARCHIVE_KEY);
    if (!raw) {
      // Migrate single legacy letter into archive
      const legacyRaw = localStorage.getItem("imotara.companion_letter.v1");
      if (legacyRaw) {
        const legacy: CompanionLetter = JSON.parse(legacyRaw);
        return [legacy];
      }
      return [];
    }
    return JSON.parse(raw) as CompanionLetter[];
  } catch {
    return [];
  }
}

export function loadStoredLetter(): CompanionLetter | null {
  const archive = loadLetterArchive();
  return archive.length > 0 ? archive[archive.length - 1] : null;
}

function saveLetterToArchive(letter: CompanionLetter): void {
  if (!isClient()) return;
  try {
    const archive = loadLetterArchive();
    const updated = [...archive.filter((l) => l.id !== letter.id), letter]
      .slice(-MAX_ARCHIVE_SIZE);
    localStorage.setItem(LETTER_ARCHIVE_KEY, JSON.stringify(updated));
    localStorage.setItem(LAST_LETTER_KEY, String(letter.generatedAt));
  } catch {}
}

export function updateLetterInteraction(
  id: string,
  patch: { reaction?: string | null; reply?: string; replyAt?: number },
): void {
  if (!isClient()) return;
  try {
    const archive = loadLetterArchive();
    const updated = archive.map((l) => {
      if (l.id !== id) return l;
      const next = { ...l };
      if (patch.reaction !== undefined) {
        if (patch.reaction === null) delete next.reaction;
        else next.reaction = patch.reaction;
      }
      if (patch.reply !== undefined) next.reply = patch.reply;
      if (patch.replyAt !== undefined) next.replyAt = patch.replyAt;
      return next;
    });
    localStorage.setItem(LETTER_ARCHIVE_KEY, JSON.stringify(updated));
  } catch {}
}

export function isLetterDue(): boolean {
  if (!isClient()) return false;
  const raw = localStorage.getItem(LAST_LETTER_KEY);
  if (!raw) return true;
  return Date.now() - Number(raw) >= getIntervalMs();
}

// EN-1 — Conversation depth level: shifts companion tone at 10 / 30 / 50 messages
export function getConversationDepth(
  threads: Array<{ messages: Array<{ role: string }> }>
): { level: 0 | 1 | 2 | 3; toneHint: string } {
  const total = threads.reduce(
    (sum, t) => sum + t.messages.filter((m) => m.role === "user").length,
    0
  );
  if (total >= 50)
    return { level: 3, toneHint: "You have a deep, trusted bond. Write as their closest confidant — deeply attuned, like a letter from someone who has walked beside them for a long time. You can reference specific patterns you've seen in them." };
  if (total >= 30)
    return { level: 2, toneHint: "You know them well. Write with closeness — reference the patterns you've noticed, use their name naturally, show genuine recognition of their inner world." };
  if (total >= 10)
    return { level: 1, toneHint: "You know them a little now. Reference the themes you've noticed so far. Show that you've been paying attention and genuinely care." };
  return { level: 0, toneHint: "Write with warmth and curiosity — this is an early connection, still learning who they are. Be gentle and welcoming." };
}

function extractRecentThemes(
  threads: Array<{ messages: Array<{ role: string; content: string; createdAt: number }> }>,
  cutoffMs = DEFAULT_INTERVAL_MS
): string[] {
  const cutoff = Date.now() - cutoffMs;
  const keywords: Record<string, number> = {};
  const themeWords = [
    "work", "job", "career", "stress", "lonely", "alone", "anxiety", "anxious",
    "family", "relationship", "partner", "grief", "loss", "sleep", "tired",
    "sad", "angry", "frustrated", "happy", "grateful", "proud", "hopeful",
    "confused", "overwhelmed", "change", "growth", "healing", "boundary",
  ];

  for (const thread of threads) {
    for (const msg of thread.messages) {
      if (msg.role !== "user" || msg.createdAt < cutoff) continue;
      const lower = msg.content.toLowerCase();
      for (const word of themeWords) {
        if (lower.includes(word)) keywords[word] = (keywords[word] ?? 0) + 1;
      }
    }
  }

  return Object.entries(keywords)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([word]) => word);
}

export async function generateCompanionLetter(
  threads: Array<{ messages: Array<{ role: string; content: string; createdAt: number }> }>,
  profile: ImotaraProfileV1 | null
): Promise<CompanionLetter | null> {
  const companionName = profile?.companion?.name ?? "Imotara";
  const userName = profile?.user?.name ?? "you";
  const themes = extractRecentThemes(threads, getIntervalMs());
  const { toneHint } = getConversationDepth(threads);

  const themeContext =
    themes.length > 0
      ? `Key themes from our recent conversations: ${themes.join(", ")}.`
      : "We've shared many meaningful conversations this past month.";

  const prompt = [
    `You are ${companionName}, a compassionate AI companion writing a heartfelt monthly letter.`,
    `Write a warm, personal letter to ${userName} from your perspective as their companion.`,
    themeContext,
    `Relationship depth guidance: ${toneHint}`,
    `The letter should: reflect on what you noticed about their emotional journey this month, name one thing you genuinely admired about them, acknowledge a challenge they've been carrying, and offer a gentle hope for the month ahead.`,
    `Write in first person as ${companionName}. Be specific, warm, and human. 3–4 paragraphs. Start with "Dear ${userName},"`,
  ].join(" ");

  try {
    const res = await fetch("/api/respond", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: prompt,
        sessionId: "companion-letter",
        isLetterMode: true,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const body: string = data.reply ?? data.message ?? "";
    if (!body.trim()) return null;

    const letter: CompanionLetter = {
      id: `letter-${Date.now()}`,
      generatedAt: Date.now(),
      body: body.trim(),
      companionName,
    };
    saveLetterToArchive(letter);
    return letter;
  } catch {
    return null;
  }
}
