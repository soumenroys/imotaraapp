"use client";

import { useState } from "react";

const MOODS = [
  { key: "calm", label: "Calm", emoji: "🧘" },
  { key: "happy", label: "Happy", emoji: "😊" },
  { key: "energized", label: "Energized", emoji: "⚡" },
  { key: "curious", label: "Curious", emoji: "🤔" },
  { key: "vulnerable", label: "Vulnerable", emoji: "💛" },
  { key: "lonely", label: "Lonely", emoji: "🌙" },
  { key: "flirty", label: "Flirty", emoji: "😉" },
];

export type MoodKey = (typeof MOODS)[number]["key"];

export default function MoodPicker({
  value,
  onChange,
}: {
  value?: MoodKey | null;
  onChange: (m: MoodKey) => void;
}) {
  const [selected, setSelected] = useState<MoodKey | null>(value ?? null);

  const handle = (k: MoodKey) => {
    setSelected(k);
    onChange(k);
  };

  return (
    <div>
      <p className="mb-2 text-sm text-gray-600">Today I feel…</p>
      <div className="flex flex-wrap gap-2">
        {MOODS.map((m) => {
          const active = selected === m.key;
          return (
            <button
              key={m.key}
              type="button"
              onClick={() => handle(m.key)}
              className={[
                "flex items-center gap-2 rounded-md border px-3 py-2 text-sm",
                active ? "border-gray-900 bg-gray-900 text-white" : "bg-white",
              ].join(" ")}
              aria-pressed={active}
            >
              <span aria-hidden>{m.emoji}</span>
              <span>{m.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
