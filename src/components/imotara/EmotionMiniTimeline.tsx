// src/components/imotara/EmotionMiniTimeline.tsx
"use client";

import type { EmotionRecord } from "@/types/history";

type TimelineRecord = EmotionRecord & {
  pending?: boolean;
  conflict?: boolean;
};

type Props = {
  records: TimelineRecord[];
};

export default function EmotionMiniTimeline({ records }: Props) {
  if (!records || records.length === 0) return null;

  // Sort by time ascending (older to newer)
  const sorted = [...records].sort((a, b) => {
    const ta = a.createdAt ?? a.updatedAt ?? 0;
    const tb = b.createdAt ?? b.updatedAt ?? 0;
    return ta - tb;
  });

  const times = sorted
    .map((r) => r.createdAt ?? r.updatedAt ?? 0)
    .filter((t) => t);

  if (times.length === 0) return null;

  const minTs = times[0];
  const maxTs = times[times.length - 1];
  const span = maxTs - minTs || 1;

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-xs text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950/40 dark:text-zinc-300">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Timeline
        </span>
        <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
          {records.length} entr{records.length === 1 ? "y" : "ies"}
        </span>
      </div>

      <div className="relative flex h-8 items-center">
        {/* track */}
        <div className="h-[2px] w-full rounded-full bg-zinc-200 dark:bg-zinc-800" />

        {/* dots */}
        {sorted.map((record) => {
          const t = record.createdAt ?? record.updatedAt ?? 0;
          if (!t) return null;
          const x = ((t - minTs) / span) * 100;

          const isPending = Boolean(record.pending ?? (record as any).localOnly);
          const hasConflict = Boolean(record.conflict);

          const base =
            "group absolute -top-1 h-3 w-3 -translate-x-1/2 rounded-full ring-1 transition-transform hover:scale-110";

          const colorClass = hasConflict
            ? "bg-amber-500 ring-amber-300/80 dark:bg-amber-400 dark:ring-amber-600/80"
            : isPending
            ? "bg-blue-500 ring-blue-300/80 dark:bg-blue-400 dark:ring-blue-600/80"
            : "bg-zinc-400 ring-zinc-300/80 dark:bg-zinc-500 dark:ring-zinc-700/80";

          const title =
            (record.message?.trim() || "(no message)") +
            (record.emotion ? ` — ${record.emotion}` : "");

          return (
            <div
              key={record.id}
              className={`${base} ${colorClass}`}
              style={{ left: `${x}%` }}
              title={title}
            />
          );
        })}
      </div>

      {/* tiny legend */}
      <div className="mt-2 flex flex-wrap items-center gap-3 text-[10px] text-zinc-500 dark:text-zinc-400">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-zinc-400" /> Synced
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-blue-500" /> Pending
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-amber-500" /> Conflict
        </span>
      </div>
    </div>
  );
}
