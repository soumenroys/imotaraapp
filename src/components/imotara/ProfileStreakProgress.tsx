// src/components/imotara/ProfileStreakProgress.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const STORAGE_KEY = "imotara.reflections.v1";
const MIN_QUALITY_CHARS = 30;
const GOAL_DAYS = 7;

function computeUniqueDays(entries: { createdAt: number; response: string }[]): number {
  const days = new Set(
    entries
      .filter((e) => (e.response ?? "").trim().length >= MIN_QUALITY_CHARS)
      .map((e) => new Date(e.createdAt).toDateString()),
  );
  return days.size;
}

export default function ProfileStreakProgress({ compact = false }: { compact?: boolean }) {
  const [days, setDays] = useState<number | null>(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) { setDays(0); return; }
      const parsed = JSON.parse(raw);
      setDays(Array.isArray(parsed) ? computeUniqueDays(parsed) : 0);
    } catch {
      setDays(0);
    }
  }, []);

  if (days === null) return null;

  const pct = Math.min(100, Math.round((days / GOAL_DAYS) * 100));
  const unlocked = days >= GOAL_DAYS;

  if (compact) {
    if (unlocked) return null;
    return (
      <div className="w-full max-w-[220px]">
        <div className="mb-1 flex items-center justify-between text-[11px]">
          <span className="text-zinc-400">Progress</span>
          <span className="tabular-nums font-medium text-zinc-300">{days} / {GOAL_DAYS} days</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800/80">
          <div
            className="h-1.5 rounded-full bg-gradient-to-r from-indigo-400 via-sky-400 to-emerald-400"
            style={{ width: `${pct}%`, transition: "width 0.7s ease-out" }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-zinc-400">
      {unlocked ? (
        <p className="text-sm font-medium text-emerald-300">
          🌟 Emotional fingerprint unlocked — keep reflecting to deepen it.
        </p>
      ) : (
        <>
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-zinc-400">
              Journaling progress toward fingerprint
            </span>
            <span className="tabular-nums text-xs font-medium text-zinc-300">
              {days} / {GOAL_DAYS} days
            </span>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
            <div
              className="h-1.5 rounded-full bg-gradient-to-r from-indigo-400 via-sky-400 to-emerald-400"
              style={{ width: `${pct}%`, transition: "width 0.7s ease-out" }}
            />
          </div>
          <p className="mt-1.5 text-[11px] text-zinc-600">
            {GOAL_DAYS - days} more day{GOAL_DAYS - days !== 1 ? "s" : ""} of reflecting to unlock your emotional fingerprint.{" "}
            <Link href="/grow" className="text-indigo-400/80 underline underline-offset-2 hover:text-indigo-300 transition">
              Reflect today →
            </Link>
          </p>
        </>
      )}
    </div>
  );
}
