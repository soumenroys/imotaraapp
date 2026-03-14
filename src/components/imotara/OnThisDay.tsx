// src/components/imotara/OnThisDay.tsx
"use client";

import { useEffect, useState } from "react";

const EMOJI: Record<string, string> = {
  joy: "😊", happy: "😊", happiness: "😊",
  sad: "😔", sadness: "😔", lonely: "🌧️",
  angry: "😤", anger: "😤",
  stressed: "😰", stress: "😰",
  anxious: "😟", anxiety: "😟", fear: "😟",
  neutral: "😐", surprise: "😮",
};

type OTDEntry = {
  emotion: string;
  message: string;
  createdAt: number;
  daysAgo: number;
};

function loadOnThisDay(): OTDEntry | null {
  try {
    const raw = localStorage.getItem("imotara:history:v1");
    if (!raw) return null;
    const all = JSON.parse(raw) as any[];
    if (!Array.isArray(all)) return null;

    const now = new Date();
    const todayMonth = now.getMonth();
    const todayDay = now.getDate();
    const nowMs = now.getTime();

    const candidates: OTDEntry[] = [];

    for (const r of all) {
      if (r.deleted || !r.emotion || r.emotion === "neutral") continue;
      const d = new Date(r.createdAt ?? 0);
      if (d.getMonth() === todayMonth && d.getDate() === todayDay) {
        const daysAgo = Math.round((nowMs - r.createdAt) / 86_400_000);
        if (daysAgo >= 7) {
          candidates.push({
            emotion: r.emotion,
            message: (r.message ?? "").slice(0, 140),
            createdAt: r.createdAt,
            daysAgo,
          });
        }
      }
    }

    if (!candidates.length) return null;

    // Return the most recent one that's at least a week old
    candidates.sort((a, b) => b.createdAt - a.createdAt);
    return candidates[0];
  } catch {
    return null;
  }
}

function formatTimeAgo(daysAgo: number): string {
  if (daysAgo >= 365) {
    const years = Math.floor(daysAgo / 365);
    return `${years} year${years !== 1 ? "s" : ""} ago`;
  }
  if (daysAgo >= 30) {
    const months = Math.floor(daysAgo / 30);
    return `${months} month${months !== 1 ? "s" : ""} ago`;
  }
  if (daysAgo >= 7) {
    const weeks = Math.floor(daysAgo / 7);
    return `${weeks} week${weeks !== 1 ? "s" : ""} ago`;
  }
  return `${daysAgo} day${daysAgo !== 1 ? "s" : ""} ago`;
}

export default function OnThisDay() {
  const [entry, setEntry] = useState<OTDEntry | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setEntry(loadOnThisDay());
  }, []);

  if (!entry || dismissed) return null;

  const emoji = EMOJI[(entry.emotion ?? "").toLowerCase()] ?? "💭";
  const timeAgo = formatTimeAgo(entry.daysAgo);

  return (
    <div className="animate-fade-in relative rounded-2xl border border-amber-400/20 bg-amber-500/8 px-4 py-3 shadow-sm backdrop-blur-md">
      {/* dismiss */}
      <button
        type="button"
        aria-label="Dismiss memory"
        onClick={() => setDismissed(true)}
        className="absolute right-3 top-3 text-zinc-500 hover:text-zinc-300 transition text-xs leading-none"
      >
        ✕
      </button>

      <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-amber-400/80">
        On this day · {timeAgo}
      </p>

      <div className="flex items-start gap-2">
        <span className="mt-0.5 text-xl leading-none" aria-hidden="true">{emoji}</span>
        <div className="min-w-0">
          <p className="text-xs font-medium capitalize text-zinc-200">
            You were feeling {entry.emotion}
          </p>
          {entry.message && (
            <p className="mt-0.5 truncate text-[11px] text-zinc-400 italic">
              &ldquo;{entry.message}{entry.message.length >= 140 ? "…" : ""}&rdquo;
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
