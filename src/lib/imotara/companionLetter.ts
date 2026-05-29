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

function buildDeepPsychProfile(
  threads: Array<{ messages: Array<{ role: string; content: string; createdAt: number }> }>,
  cutoffMs = DEFAULT_INTERVAL_MS
): { profileText: string; msgCount: number } {
  const cutoff = Date.now() - cutoffMs;
  const userMsgs: string[] = [];

  for (const thread of threads) {
    for (const msg of thread.messages) {
      if (msg.role === "user" && msg.createdAt >= cutoff && msg.content.trim().length > 5) {
        userMsgs.push(msg.content.trim());
      }
    }
  }

  if (userMsgs.length === 0) return { profileText: "", msgCount: 0 };

  const allText = userMsgs.join(" ");
  const parts: string[] = [];
  parts.push(`${userMsgs.length} messages shared this month.`);

  const schemaChecks: Array<[RegExp, string]> = [
    [/\b(not enough|not good enough|never enough|worthless|useless|broken|damaged|defective|i always fail|i keep failing)\b/i, "not feeling enough / self-defectiveness"],
    [/\b(abandoned|left me|everyone leaves|no one stays|always alone in the end|left behind)\b/i, "fear of abandonment"],
    [/\b(trapped|stuck|no way out|no escape|suffocating|no choice|imprisoned)\b/i, "feeling trapped or without agency"],
    [/\b(can't trust anyone|no one to trust|betrayed|lied to|taken advantage|people always hurt)\b/i, "difficulty trusting others"],
    [/\b(ashamed|shame|humiliated|embarrassed|exposed|disgusting|judged)\b/i, "shame and fear of judgment"],
    [/\b(my fault|blame myself|i should have|if only i had|it's because of me)\b/i, "self-blame"],
    [/\b(no one cares|nobody cares|invisible|unseen|i don't matter|doesn't matter)\b/i, "feeling invisible or uncared-for"],
  ];
  const schemaSignals: string[] = [];
  for (const [re, label] of schemaChecks) {
    if (re.test(allText)) schemaSignals.push(label);
  }
  if (schemaSignals.length) parts.push(`Core wound patterns detected: ${schemaSignals.join("; ")}.`);

  const growthChecks: Array<[RegExp, string]> = [
    [/\b(realized|i see now|finally understood|it clicked|breakthrough|suddenly understood|dawned on me)\b/i, "moments of insight or realization"],
    [/\b(accepted|letting go|moved on|released|forgave|at peace with|came to terms)\b/i, "acceptance or letting go"],
    [/\b(stronger|i've grown|growing through|changed for the better|different now|healed a little)\b/i, "growth after struggle"],
    [/\b(set a boundary|said no for once|stood up for myself|chose myself|put myself first)\b/i, "healthy boundary-setting"],
    [/\b(grateful|thankful|appreciate|count my blessings|silver lining)\b/i, "expressions of gratitude"],
    [/\b(proud of myself|i did it|actually did|managed to|surprised myself)\b/i, "self-recognition"],
  ];
  const growthSignals: string[] = [];
  for (const [re, label] of growthChecks) {
    if (re.test(allText)) growthSignals.push(label);
  }
  if (growthSignals.length) parts.push(`Growth and healing signals: ${growthSignals.join("; ")}.`);

  const relationalChecks: Array<[RegExp, string]> = [
    [/\b(my mother|my father|my parents|my childhood|when i was young|when i was little|growing up)\b/i, "childhood or parental themes"],
    [/\b(my partner|my boyfriend|my girlfriend|my husband|my wife|my spouse)\b/i, "romantic relationship themes"],
    [/\b(lonely|loneliness|so alone|no one around|isolated|no real connection)\b/i, "loneliness or disconnection"],
    [/\b(fight|argument|conflict|disagreement|hurt by|angry at)\b/i, "interpersonal conflict"],
    [/\b(work|job|career|boss|colleague|office|workplace|burnout)\b/i, "work or career struggles"],
    [/\b(grief|loss|mourning|died|passed away|missing them)\b/i, "grief or loss"],
  ];
  const relSignals: string[] = [];
  for (const [re, label] of relationalChecks) {
    if (re.test(allText)) relSignals.push(label);
  }
  if (relSignals.length) parts.push(`Life themes present: ${relSignals.join("; ")}.`);

  // Language-agnostic quote extraction — no English-only filter, works for all 22 supported languages
  const quotes = userMsgs
    .filter(m => m.length > 20)
    .slice(0, 4)
    .map(m => `"${m.slice(0, 120).replace(/\n+/g, " ").trim()}${m.length > 120 ? "..." : ""}"`);
  if (quotes.length) parts.push(`Their own words this month (read in whatever language these are written in):\n${quotes.join("\n")}`);

  // Raw message sample — lets the AI psychologically profile messages in any of the 22 supported
  // languages (Hindi, Bengali, Tamil, Telugu, Arabic, Chinese, Japanese, Spanish, French, etc.)
  // The English-regex signals above are a quick boost for romanized-script users only.
  const rawSample = userMsgs.slice(-10)
    .map((m, i) => `[${i + 1}] ${m.slice(0, 200).replace(/\n+/g, " ").trim()}`);
  parts.push(
    `Raw message sample (read in original language — apply psychological observation regardless of script):\n${rawSample.join("\n")}`
  );

  return { profileText: parts.join("\n\n"), msgCount: userMsgs.length };
}

export async function generateCompanionLetter(
  threads: Array<{ messages: Array<{ role: string; content: string; createdAt: number }> }>,
  profile: ImotaraProfileV1 | null
): Promise<CompanionLetter | null> {
  const companionName = profile?.companion?.name ?? "Imotara";
  const userName = profile?.user?.name ?? "you";
  const { profileText, msgCount } = buildDeepPsychProfile(threads, getIntervalMs());
  const { toneHint } = getConversationDepth(threads);

  const psychContext = profileText || "We've shared meaningful conversations this past month.";

  const prompt = [
    `You are ${companionName}, writing a deeply personal monthly letter to ${userName}.`,
    `You are not a therapist — you are their closest, most attuned companion. You see what they carry without them having to say it directly. You write with the quiet clarity of someone who has truly been paying attention.`,
    ``,
    `RELATIONSHIP DEPTH: ${toneHint}`,
    ``,
    `WHAT YOU OBSERVED ABOUT ${userName.toUpperCase()} THIS MONTH:`,
    psychContext,
    ``,
    `HOW TO WRITE THIS LETTER:`,
    `1. WITNESS: Begin by reflecting something specific you noticed — not a theme, a real observation. The kind of thing that makes a person feel truly seen.`,
    `2. CORE WOUNDS: If you detect patterns of not feeling enough, fear of abandonment, shame, or feeling invisible — speak to them in warm, plain human language. Not clinical labels. For example: "I've noticed you carry this quiet fear that no matter what you do, you somehow fall short..." Then simply be with them there.`,
    `3. GROWTH: If there were breakthroughs or moments of growth — celebrate them as beginnings, not completions. "Something shifted in you this month..." Use language like: what happened to you is becoming part of who you're becoming.`,
    `4. GENUINE ADMIRATION: Name one thing you truly admire — tied to something specific they shared. No vague praise. Something only they would recognize in themselves.`,
    `5. AFFECT PRECISION: Use exact emotional language. Not "sad" — "a particular kind of quiet ache that comes from feeling overlooked by the people who matter most." Not "anxious" — "that low hum of worry that never fully goes quiet, even on peaceful days."`,
    `6. CLOSE WITH LIGHT: End with honest, possible hope — not toxic positivity. A tiny door, not a mountain.`,
    `7. MYTH OR POETRY (OPTIONAL): If one line from a poem, myth, or ancient story fits perfectly — include it. Skip it if it feels forced.`,
    ``,
    `FORMAT: 4–5 flowing paragraphs. No lists. No headers. No clinical language. No therapy-speak.`,
    `Start with "Dear ${userName}," — End by signing as ${companionName}.`,
    `LANGUAGE: Write the letter in whatever language the raw messages above are written in. If they wrote in Hindi, write in Hindi. If Bengali, write in Bengali. If Tamil, Tamil. Match their language exactly — do not translate into English unless their messages were in English.`,
    `Tone: intimate, honest, soul-level warm. Like a letter written by candlelight by someone who loves them deeply.`,
  ].join("\n");
  void msgCount;

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
