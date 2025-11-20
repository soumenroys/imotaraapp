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

/**
 * Mini timeline dots overlay
 * - No own card, track, or legend
 * - Just glowing dots positioned along the parent track
 * - Parent (EmotionTimeline) is responsible for the background rail + legend
 */
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
    <div className="relative h-4 w-full">
      {sorted.map((record) => {
        const t = record.createdAt ?? record.updatedAt ?? 0;
        if (!t) return null;
        const x = ((t - minTs) / span) * 100;

        const isPending = Boolean(record.pending ?? (record as any).localOnly);
        const hasConflict = Boolean(record.conflict);
        const isServerConfirmed = Boolean((record as any).serverConfirmed);

        // base glow dot
        const base =
          "group absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full shadow-md transition-transform hover:scale-110";

        // Source-aware colours (Aurora Calm tuned)
        let colorClass =
          "bg-zinc-400 shadow-[0_0_10px_rgba(148,163,184,0.6)]"; // default synced-ish

        if (hasConflict) {
          colorClass =
            "bg-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.8)]";
        } else if (isPending) {
          colorClass =
            "bg-sky-400 shadow-[0_0_12px_rgba(56,189,248,0.8)]";
        } else if (record.source === "chat") {
          colorClass =
            "bg-purple-400 shadow-[0_0_12px_rgba(168,85,247,0.8)]";
        } else if (record.source === "local") {
          colorClass =
            "bg-indigo-400 shadow-[0_0_12px_rgba(129,140,248,0.8)]";
        } else if (record.source === "remote" || record.source === "merged") {
          colorClass =
            "bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.8)]";
        }

        // ⭐ server-confirmed subtle rim highlight on top of colour
        const rimClass = isServerConfirmed
          ? " ring-2 ring-emerald-300/80"
          : " ring-[1.5px] ring-white/40";

        // label for native tooltip
        const rawSource = record.source;
        const sourceLabel =
          rawSource === "chat"
            ? "Chat"
            : rawSource === "local"
              ? "Local"
              : rawSource === "remote"
                ? "Remote"
                : rawSource === "merged"
                  ? "Merged"
                  : undefined;

        const parts: string[] = [];
        if (sourceLabel) parts.push(`[${sourceLabel}]`);
        const msg = record.message?.trim() || "(no message)";
        parts.push(msg);
        if (record.emotion) parts.push(`(${record.emotion})`);
        const label = parts.join(" ");

        return (
          <div
            key={record.id}
            className={`${base} ${colorClass} ${rimClass}`}
            style={{ left: `${x}%` }}
            title={label}
          />
        );
      })}
    </div>
  );
}
