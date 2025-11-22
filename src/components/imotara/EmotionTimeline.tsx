// src/components/imotara/EmotionTimeline.tsx
"use client";

import { format } from "date-fns";
import { primaryTag } from "@/lib/imotara/history";
import type { EmotionRecord } from "@/types/history";
import EmotionMiniTimeline from "@/components/imotara/EmotionMiniTimeline";

// emotion → color mapping for timeline glow dots
const emotionColorMap: Record<string, string> = {
  happy: "from-yellow-400 to-amber-500",
  sad: "from-blue-400 to-indigo-500",
  angry: "from-red-500 to-rose-600",
  calm: "from-teal-400 to-emerald-500",
  neutral: "from-zinc-400 to-zinc-600",
  fear: "from-purple-500 to-fuchsia-600",
  disgust: "from-green-500 to-lime-500",
};

type Props = {
  items: EmotionRecord[];
};

export default function EmotionTimeline({ items }: Props) {
  // ⬇️ Defensive guard: always work with a safe array
  const safeItems = Array.isArray(items) ? items : [];
  const totalEntries = safeItems.length;

  if (!safeItems || safeItems.length === 0) {
    return (
      <div className="imotara-glass-soft rounded-2xl p-6 text-sm text-zinc-500 dark:text-zinc-400">
        No history to display yet. As you chat with Imotara, your emotional
        timeline will grow here.
      </div>
    );
  }

  // Group items per day
  const byDay = new Map<string, EmotionRecord[]>();
  for (const r of safeItems) {
    const t = r.createdAt ?? r.updatedAt ?? 0;
    if (!t || Number.isNaN(t)) continue;
    const dayKey = format(new Date(t), "yyyy-MM-dd");
    const arr = byDay.get(dayKey);
    if (arr) arr.push(r);
    else byDay.set(dayKey, [r]);
  }

  const days = Array.from(byDay.entries()).sort(([a], [b]) =>
    a < b ? 1 : a > b ? -1 : 0
  );

  return (
    <div className="space-y-12" aria-label="Emotion timeline">
      {/* MINI TIMELINE AREA */}
      <section
        className="imotara-glass-card mt-4 rounded-2xl p-4"
        aria-label="Overall emotion timeline"
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Overall Timeline
          </h3>
          <span className="imotara-pill text-[10px] text-zinc-500 dark:text-zinc-300">
            {totalEntries} entr{totalEntries === 1 ? "y" : "ies"}
          </span>
        </div>

        {/* Glow timeline wrapper */}
        <div className="relative mb-1">
          {/* Track */}
          <div className="h-1.5 w-full rounded-full bg-gradient-to-r from-indigo-600/35 via-sky-500/25 to-emerald-500/35" />

          {/* Emotion dots rendered by MiniTimeline */}
          <div
            className="pointer-events-none absolute inset-0 flex items-center"
            aria-hidden="true"
          >
            <EmotionMiniTimeline records={safeItems} />
          </div>
        </div>

        {/* Legend row (aligned with EmotionMiniTimeline colors) */}
        <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px] text-zinc-500 dark:text-zinc-400">
          <span className="imotara-pill flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            Synced
          </span>
          <span className="imotara-pill flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-indigo-400" />
            Local
          </span>
          <span className="imotara-pill flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-purple-400" />
            Chat
          </span>
          <span className="imotara-pill flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-sky-400" />
            Pending
          </span>
          <span className="imotara-pill flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-amber-400" />
            Conflict
          </span>
        </div>
      </section>

      {/* DAILY SECTIONS */}
      {days.map(([dayKey, recs]) => {
        const sorted = recs
          .slice()
          .sort((a, b) => {
            const ta = a.createdAt ?? a.updatedAt ?? 0;
            const tb = b.createdAt ?? b.updatedAt ?? 0;
            return ta - tb;
          });

        let dayLabel = dayKey;
        try {
          dayLabel = format(new Date(dayKey), "EEEE, MMM d yyyy");
        } catch {
          // fall back to raw key if formatting fails
          dayLabel = dayKey;
        }

        return (
          <section
            key={dayKey}
            className="imotara-glass-soft rounded-2xl bg-white/[0.08] p-5 shadow-lg ring-1 ring-white/5 transition-colors hover:bg-white/[0.12] dark:bg-white/5 dark:ring-white/10 dark:hover:bg-white/10"
            aria-label={`Entries for ${dayLabel}`}
          >
            <div className="mb-4 flex items-center justify-between">
              <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-200">
                {dayLabel}
              </div>
              <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                {sorted.length} entr{sorted.length === 1 ? "y" : "ies"}
              </div>
            </div>

            <ul className="space-y-3" role="list">
              {sorted.map((r) => {
                const when = r.updatedAt ?? r.createdAt ?? 0;
                const tag = primaryTag(r);
                const tagText =
                  tag && typeof tag.intensity === "number"
                    ? `${tag.emotion} · ${(tag.intensity * 100).toFixed(0)}%`
                    : String(r.emotion);

                const emotionKey = r.emotion || "neutral";
                const glowColors =
                  emotionColorMap[emotionKey] ?? "from-zinc-500 to-zinc-700";

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

                const messageText =
                  r.message?.trim() && r.message.trim().length > 0
                    ? r.message
                    : "No message";

                const timeText = when
                  ? format(new Date(when), "HH:mm:ss")
                  : "--:--:--";

                return (
                  <li
                    key={r.id}
                    className={[
                      "imotara-history-item relative p-4 shadow-md transition-all hover:shadow-lg",
                      isServerConfirmed ? "ring-1 ring-emerald-500/40" : "",
                    ].join(" ")}
                    aria-label={`Emotion ${tagText || r.emotion} at ${timeText}`}
                  >
                    {/* Glow dot at left */}
                    <div
                      className={`pointer-events-none absolute left-[-14px] top-5 h-3 w-3 rounded-full bg-gradient-to-br ${glowColors} shadow-[0_0_12px_rgba(255,255,255,0.35)]`}
                      aria-hidden="true"
                    />

                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="line-clamp-3 whitespace-pre-wrap text-sm text-zinc-900 dark:text-zinc-200">
                          {r.message?.trim() ? (
                            r.message
                          ) : (
                            <em className="text-zinc-500 dark:text-zinc-400">
                              No message
                            </em>
                          )}
                        </div>

                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                          <span>{tagText}</span>

                          {sourceLabel && (
                            <span className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-2 py-0.5 text-[10px] text-zinc-700 backdrop-blur-sm dark:text-zinc-200">
                              {sourceLabel}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex shrink-0 flex-col items-end gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                        <div className="flex items-center gap-1">
                          {hasConflict && (
                            <span className="rounded-full border border-amber-400/50 bg-amber-500/20 px-2 py-0.5 text-[10px] text-amber-900 backdrop-blur-sm dark:text-amber-200">
                              Conflict
                            </span>
                          )}

                          {isPending && (
                            <span className="rounded-full border border-sky-400/50 bg-sky-500/20 px-2 py-0.5 text-[10px] text-sky-900 backdrop-blur-sm dark:text-sky-100">
                              Pending
                            </span>
                          )}
                        </div>

                        <div className="text-right text-zinc-600 dark:text-zinc-300">
                          {timeText}
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
