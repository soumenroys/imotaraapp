// src/components/emotion/EmotionTimeline.tsx
"use client";

import { format } from "date-fns";
import { primaryTag } from "@/lib/imotara/history";
import type { EmotionSample } from "@/types/history";

type Props = {
  items: EmotionSample[];
};

export default function EmotionTimeline({ items }: Props) {
  if (!items.length) {
    return (
      <div className="rounded-2xl border border-zinc-200 p-6 text-sm text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
        No entries match your filters yet.
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {items.map((s) => {
        const p = primaryTag(s);
        return (
          <li
            key={s.id}
            className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                {p?.emotion ?? "unknown"} · {(p?.intensity ?? 0).toFixed(2)}
              </div>
              <div className="text-xs text-zinc-500 dark:text-zinc-500">
                {format(new Date(s.timestamp), "MMM d, yyyy HH:mm")} · {s.source}
              </div>
            </div>
            <p className="mt-2 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
              {s.text}
            </p>
          </li>
        );
      })}
    </ul>
  );
}
