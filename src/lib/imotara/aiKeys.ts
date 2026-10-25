// src/lib/imotara/aiKeys.ts
// Which API key a background feature uses. Kept OUT of aiClient.ts: that file is
// "use server", where every export must be an async function — a plain helper
// exported from it failed the production build (26 Oct 2026).
//
// Each feature may have its OWN key (OPENAI_API_KEY_<FEATURE>,
// GEMINI_API_KEY_<FEATURE>) so its cost shows on its own line, a runaway job can
// only exhaust its own cap, and one leaked key can be revoked without touching
// the others. Unset or blank ⇒ the shared key, exactly as before.

export type AIFeature = "social" | "trends" | "outreach" | "newsletter";

export function aiKeyFor(provider: "openai" | "gemini", feature?: AIFeature): string | undefined {
  const shared = provider === "openai" ? "OPENAI_API_KEY" : "GEMINI_API_KEY";
  const own = feature ? process.env[`${shared}_${feature.toUpperCase()}`]?.trim() : undefined;
  return own || process.env[shared];
}
