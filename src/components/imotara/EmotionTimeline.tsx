// src/components/imotara/EmotionTimeline.tsx
"use client";

import { format } from "date-fns";
import { primaryTag } from "@/lib/imotara/history";
import type { EmotionRecord } from "@/types/history";
import EmotionMiniTimeline from "@/components/imotara/EmotionMiniTimeline";

type Props = {
  items: EmotionRecord[];
};

export default function EmotionTimeline({ items }: Props) {
  if (!items || items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-300 p-4 text-sm text-zinc-500 dark:border-zinc-700">
        No history to display.
      </div>
    );
  }

  // Group by day (YYYY-MM-DD), newest day first
  const byDay = new Map<string, EmotionRecord[]>();
  for (const r of items) {
    const t = r.createdAt ?? r.updatedAt ?? 0;
    if (!t) continue;
    const dayKey = format(new Date(t), "yyyy-MM-dd");
    const arr = byDay.get(dayKey);
    if (arr) arr.push(r);
    else byDay.set(dayKey, [r]);
  }

  const days = Array.from(byDay.entries()).sort(([a], [b]) =>
    a < b ? 1 : a > b ? -1 : 0
  );

  return (
    <div className="space-y-6">
      {/* Mini timeline */}
      <div className="mt-4">
        <EmotionMiniTimeline records={items} />
      </div>

      {days.map(([dayKey, recs]) => {
        const sorted = recs
          .slice()
          .sort((a, b) => {
            const ta = a.createdAt ?? a.updatedAt ?? 0;
            const tb = b.createdAt ?? b.updatedAt ?? 0;
            return ta - tb;
          });

        const dayLabel = format(new Date(dayKey), "PPPP");

        return (
          <section key={dayKey}>
            <div className="mb-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">
              {dayLabel}
            </div>

            <ul className="space-y-2">
              {sorted.map((r) => {
                const when = r.updatedAt ?? r.createdAt ?? 0;
                const tag = primaryTag(r);
                const tagText =
                  tag && typeof tag.intensity === "number"
                    ? `${tag.emotion} · ${(tag.intensity * 100).toFixed(0)}%`
                    : String(r.emotion);

                const anyRecord = r as any;

                const hasConflict = Boolean(anyRecord.conflict);
                const isPending = Boolean(
                  anyRecord.localOnly ?? anyRecord.pending
                );
                const isServerConfirmed = Boolean(anyRecord.serverConfirmed);

                const rawSource = r.source ?? "local";
                const sourceLabel =
                  rawSource === "local"
                    ? "Local"
                    : rawSource === "remote"
                      ? "Remote"
                      : rawSource === "merged"
                        ? "Merged"
                        : rawSource === "chat"
                          ? "Chat"
                          : rawSource;

                return (
                  <li
                    key={r.id}
                    className={`rounded-xl border border-zinc-200 bg-white p-3 text-sm dark:border-zinc-800 dark:bg-zinc-900${isServerConfirmed ? " server-confirmed" : ""
                      }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="line-clamp-2 whitespace-pre-wrap text-zinc-900 dark:text-zinc-100">
                          {r.message?.trim() ? (
                            r.message
                          ) : (
                            <em className="text-zinc-500">No message</em>
                          )}
                        </div>

                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                          <span>{tagText}</span>

                          {sourceLabel && (
                            <span className="inline-flex items-center rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[10px] font-medium text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                              {sourceLabel}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex shrink-0 flex-col items-end gap-1 text-xs text-zinc-500">
                        <div className="flex items-center gap-1">
                          {hasConflict && (
                            <span className="rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800 dark:border-amber-600/60 dark:bg-amber-900/30 dark:text-amber-300">
                              Conflict
                            </span>
                          )}

                          {isPending && (
                            <span className="rounded-full border border-blue-300 bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-800 dark:border-blue-500/60 dark:bg-blue-900/30 dark:text-blue-300">
                              Pending
                            </span>
                          )}
                        </div>

                        <div className="text-right">
                          {when
                            ? format(new Date(when), "HH:mm:ss")
                            : "--:--:--"}
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
