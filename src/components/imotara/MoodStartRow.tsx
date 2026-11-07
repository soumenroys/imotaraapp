// src/components/imotara/MoodStartRow.tsx
// "How are you feeling right now?" — one tap opens the chat with an opener
// already written in the person's language (#91). The home page's row, made
// reusable for the pages AI assistants send people to (#77f, 7 Nov 2026):
// GA 10 Oct–6 Nov — 80 sessions from AI assistants, /ai-emotional-support the
// most engaged (75%, 1m42s) yet its only next step was a plain button.
"use client";

import Link from "next/link";
import { HOME_MOODS } from "@/lib/imotara/homeMoods";
import { gaEvent } from "@/lib/analytics/gaEvent";

export default function MoodStartRow({ from }: { from: string }) {
  return (
    <div className="mt-6">
      <p className="text-sm font-medium text-zinc-200">How are you feeling right now?</p>
      <div className="mt-3 flex flex-wrap gap-2" role="list" aria-label="Pick how you feel to start talking">
        {HOME_MOODS.map((m) => (
          <Link
            key={m.key}
            role="listitem"
            href={`/chat?mood=${m.key}`}
            onClick={() => gaEvent("home_mood", { mood: m.key, from })}
            className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3.5 py-2 text-sm text-zinc-100 transition hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60"
          >
            <span aria-hidden="true">{m.emoji}</span>
            <span>{m.label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
