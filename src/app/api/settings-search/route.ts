// src/app/api/settings-search/route.ts
// AI-powered settings search fallback.
// Called when local keyword matching has low confidence.
// POST { query: string } → { ids: string[] }

import { NextResponse } from "next/server";
import { callImotaraAI } from "@/lib/imotara/aiClient";

const SETTINGS_LIST = [
  { id: "companion_name", title: "Companion name", description: "Change the name of your AI companion" },
  { id: "companion_relationship", title: "Relationship style", description: "Set companion tone — close friend, calm companion, coach, or mentor" },
  { id: "companion_gender", title: "Companion gender", description: "Choose the gender tone of your companion" },
  { id: "companion_age", title: "Companion age tone", description: "Set whether the companion speaks with a younger, peer, or elder tone" },
  { id: "letter_cadence", title: "Letter frequency", description: "How often Imotara writes you a personal letter" },
  { id: "language", title: "Language", description: "Change the app language — supports 22 languages including Hindi, Bengali, Tamil, Arabic, Chinese, Japanese" },
  { id: "dark_mode", title: "Dark mode / Light mode", description: "Switch between dark and light theme" },
  { id: "text_size", title: "Text size", description: "Increase or decrease the font size" },
  { id: "companion_reactions", title: "Companion reactions", description: "Enable/disable Imotara reacting to messages with emoji" },
  { id: "show_sync_badge", title: "Show sync status badge", description: "Show or hide the Local/Cloud badge on messages" },
  { id: "mood_glimpse", title: "Mood glimpse card", description: "Show or hide the mood snapshot card in chat" },
  { id: "tts_auto_read", title: "Auto-read new messages", description: "Automatically read Imotara's responses aloud (text-to-speech)" },
  { id: "tts_speed", title: "TTS speed & pitch", description: "Adjust how fast and high the companion's voice reads messages" },
  { id: "voice_input", title: "Voice input", description: "Use microphone to speak messages instead of typing" },
  { id: "voice_quality", title: "Voice recording quality", description: "Set microphone recording quality" },
  { id: "hands_free", title: "Hands-free mode", description: "Automatically start voice input and play responses" },
  { id: "memory_capture", title: "Auto-capture memories", description: "Automatically remember things you share about yourself" },
  { id: "memory_max", title: "Memory capacity", description: "Maximum number of personal memories stored" },
  { id: "chat_cleanup", title: "Auto-delete old conversations", description: "Automatically delete conversations older than N days" },
  { id: "challenge_show", title: "30-day reflection challenge", description: "Show or hide the 30-day daily reflection challenge" },
  { id: "journal_show", title: "Reflection journal", description: "Show or hide the personal reflection journal" },
  { id: "breathing_pattern", title: "Default breathing pattern", description: "Set the default breathing exercise pattern" },
  { id: "mindset_analysis", title: "Mindset Analysis", description: "Enable/disable psychological analysis of conversations" },
  { id: "mood_chart", title: "Mood chart", description: "Show or hide the mood trend chart" },
  { id: "cloud_sync", title: "Cloud sync", description: "Sync conversations and data across devices" },
  { id: "export_data", title: "Export data", description: "Export conversation history as JSON or CSV" },
  { id: "clear_history", title: "Clear history", description: "Delete all local conversation history" },
  { id: "delete_account", title: "Delete account", description: "Permanently delete Imotara account and data" },
  { id: "upgrade_plan", title: "Upgrade plan", description: "Upgrade to Plus or Pro for unlimited replies and advanced features" },
  { id: "token_credits", title: "Token credits", description: "Buy additional AI reply tokens" },
  { id: "sign_in", title: "Sign in / Sign out", description: "Sign in with Google or Apple, or sign out" },
  { id: "donate", title: "Donate to Imotara", description: "Support development with a one-time donation" },
  { id: "app_version", title: "App version", description: "View current app version and build number" },
  { id: "emotional_arc", title: "Emotional arc cadence", description: "How often Imotara generates your emotional journey story" },
  { id: "on_this_day", title: "On this day", description: "Show a memory or reflection from the same day in previous months" },
  { id: "emotional_fingerprint", title: "Emotional fingerprint", description: "Visual chart showing your unique emotional patterns" },
  { id: "teen_mode", title: "Teen insights mode", description: "Age-appropriate responses for users aged 13-17" },
].map((s) => `${s.id}: ${s.title} — ${s.description}`).join("\n");

const SYSTEM = `You are a settings finder for the Imotara emotional wellness app.
Given a user's description of what they want to change or find, identify the most relevant settings from the list below.
Return ONLY a JSON object: {"ids": ["id1", "id2"]} with up to 3 matching setting IDs, ordered by relevance.
The query may be in any language — understand the intent regardless of language.
If nothing matches, return {"ids": []}.

SETTINGS LIST:
${SETTINGS_LIST}`;

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const query = typeof body.query === "string" ? body.query.trim().slice(0, 200) : "";
    if (!query) return NextResponse.json({ ids: [] });

    const result = await callImotaraAI(
      `User is looking for a setting. Their description: "${query}"`,
      { system: SYSTEM, maxTokens: 80, temperature: 0.1 }
    );

    if (!result.text) return NextResponse.json({ ids: [] });

    const cleaned = result.text.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
    const parsed = JSON.parse(cleaned);
    const ids = Array.isArray(parsed.ids) ? parsed.ids.filter((id: unknown) => typeof id === "string") : [];
    return NextResponse.json({ ids });
  } catch {
    return NextResponse.json({ ids: [] });
  }
}
