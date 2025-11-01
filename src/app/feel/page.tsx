"use client";

import { useState } from "react";
import MoodPicker, { type MoodKey } from "@/components/MoodPicker";
import JournalForm from "@/components/JournalForm";

type Entry = {
  id: string;
  mood: MoodKey | null;
  text: string;
  createdAt: string;
};

export default function FeelPage() {
  const [mood, setMood] = useState<MoodKey | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);

  const handleSaved = (entry: Entry) => {
    setEntries((prev) => [entry, ...prev]);
  };

  return (
    <section className="space-y-4 p-4">
      <h1 className="text-xl font-semibold">Feel</h1>

      <MoodPicker value={mood ?? undefined} onChange={setMood} />

      <JournalForm mood={mood} onSaved={handleSaved} />

      <div className="rounded-lg border p-3">
        <p className="text-sm text-gray-600">Recent entries</p>
        {entries.length === 0 ? (
          <p className="mt-2 text-sm text-gray-500">No entries yet.</p>
        ) : (
          <ul className="mt-2 space-y-2 text-sm">
            {entries.map((e) => (
              <li key={e.id} className="rounded-md bg-gray-50 p-2">
                <div className="mb-1 text-[11px] text-gray-500">
                  {new Date(e.createdAt).toLocaleString()}
                  {e.mood ? ` • mood: ${e.mood}` : ""}
                </div>
                <div>{e.text || <span className="text-gray-400">—</span>}</div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
