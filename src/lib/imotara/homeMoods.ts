// src/lib/imotara/homeMoods.ts
// "How are you feeling right now?" — the one-tap moods on the HOME page
// (owner, 7 Nov 2026 — #91 / #77a).
//
// 🔑 WHY: Google Analytics (28 days to 6 Nov) — 321 people saw the home page,
// stayed 7 seconds on average, and only 59 (18%) ever reached /chat. The admin
// Activity screen: 3.7% came back the next day. People were leaving before they
// had said a single word. So the home page itself asks the question, and one
// tap carries the answer into the chat box, already written, in the person's
// own language — they only press send.
//
// ⚠️ The KEY travels in the URL (/chat?mood=sad), never the words: the chat
// page turns it into the opener in the person's language, from the same
// MOOD_OPTIONS_BY_LANG table its own mood row uses. Nothing typed is in a URL.

export type HomeMood = { key: string; emoji: string; label: string };

/** Same emoji as the chat page's English mood row, in the same order. */
export const HOME_MOODS: readonly HomeMood[] = [
  { key: "good", emoji: "😊", label: "Good" },
  { key: "sad", emoji: "😔", label: "Sad" },
  { key: "stressed", emoji: "😰", label: "Stressed" },
  { key: "frustrated", emoji: "😤", label: "Frustrated" },
  { key: "anxious", emoji: "😟", label: "Anxious" },
  { key: "lonely", emoji: "🌧️", label: "Lonely" },
];

type MoodOption = { emoji: string; label: string; starter: string };

/**
 * The opener for a home-page mood, in the chat's language.
 * Matched by EMOJI, because a few languages (Hebrew, Arabic) list different
 * moods: if that language has no row with this emoji, the English opener is
 * used rather than a wrong feeling. Unknown key ⇒ null (nothing is prefilled).
 */
export function moodStarter(key: string | null | undefined, lang: string, byLang: Record<string, MoodOption[]>): string | null {
  const mood = HOME_MOODS.find((m) => m.key === key);
  if (!mood) return null;
  const inLang = (byLang[lang] ?? []).find((o) => o.emoji === mood.emoji);
  if (inLang) return inLang.starter;
  return (byLang.en ?? []).find((o) => o.emoji === mood.emoji)?.starter ?? null;
}
