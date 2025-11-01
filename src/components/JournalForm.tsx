"use client";

import { useState } from "react";
import type { MoodKey } from "./MoodPicker";

export default function JournalForm({
  mood,
  onSaved,
}: {
  mood: MoodKey | null;
  onSaved: (entry: { id: string; mood: MoodKey | null; text: string; createdAt: string }) => void;
}) {
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!text.trim() && !mood) return;

    setSaving(true);
    // 🔌 Supabase-ready: here we’ll insert to DB later. For now, simulate success.
    await new Promise((r) => setTimeout(r, 300));

    const entry = {
      id: crypto.randomUUID(),
      mood,
      text: text.trim(),
      createdAt: new Date().toISOString(),
    };

    onSaved(entry);
    setText("");
    setSaving(false);
  };

  return (
    <div className="rounded-lg border p-3">
      <label className="mb-2 block text-sm text-gray-600">How are you feeling today?</label>
      <textarea
        className="w-full rounded-md border px-3 py-2 outline-none focus:ring"
        rows={4}
        placeholder="Write a quick note…"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
        <span>{mood ? `Mood: ${mood}` : "No mood selected"}</span>
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-md bg-gray-900 px-4 py-2 text-white disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}
