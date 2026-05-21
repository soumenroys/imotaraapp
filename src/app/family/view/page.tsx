// src/app/family/view/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";

type FamilySnapshot = {
  displayName: string;
  week: string[];
  dominant: string;
  reflectionDays: number;
  generatedAt: string;
};

const EMOTION_EMOJI: Record<string, string> = {
  joy: "😄", happiness: "😄", happy: "😄", gratitude: "🙏", hopeful: "💚",
  sadness: "💙", sad: "💙", grief: "💜", loss: "💜",
  anxiety: "😰", anxious: "😰", stressed: "💛", stress: "💛",
  anger: "❤️", angry: "❤️", fear: "😨",
  confused: "🟣", lonely: "🫂", surprise: "✨", neutral: "💭",
};

function decodeSnapshot(raw: string): FamilySnapshot | null {
  try {
    // Try URI-encoded path first (new format), fall back to plain JSON (legacy)
    const inner = atob(raw);
    const json = inner.startsWith("%") ? decodeURIComponent(inner) : inner;
    const parsed = JSON.parse(json);
    if (parsed?.week && Array.isArray(parsed.week)) return parsed as FamilySnapshot;
  } catch {}
  return null;
}

function SnapshotView() {
  const params = useSearchParams();
  const [snap, setSnap] = useState<FamilySnapshot | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const raw = params?.get("snap");
    if (!raw) { setError(true); return; }
    const decoded = decodeSnapshot(raw);
    if (!decoded) { setError(true); return; }
    setSnap(decoded);
  }, [params]);

  if (error) {
    return (
      <div className="mx-auto max-w-sm px-4 py-16 text-center">
        <p className="text-zinc-400 text-sm mb-4">This snapshot link is invalid or has expired.</p>
        <Link href="/" className="text-indigo-400 underline text-sm">Go to Imotara →</Link>
      </div>
    );
  }

  if (!snap) {
    return (
      <div className="mx-auto max-w-sm px-4 py-16 text-center">
        <div className="h-6 w-24 mx-auto rounded bg-white/10 animate-pulse mb-3" />
        <div className="h-4 w-48 mx-auto rounded bg-white/8 animate-pulse" />
      </div>
    );
  }

  const dominantEmoji = EMOTION_EMOJI[snap.dominant.toLowerCase()] ?? "💭";
  const dominantLabel = snap.dominant.charAt(0).toUpperCase() + snap.dominant.slice(1);

  return (
    <div className="mx-auto max-w-sm px-4 py-10">
      <div className="mb-6 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 via-sky-500 to-emerald-400 text-2xl shadow-lg">
          💚
        </div>
        <h1 className="text-base font-semibold text-zinc-50">
          {snap.displayName ? `${snap.displayName}'s` : "A"} Mood Snapshot
        </h1>
        <p className="mt-1 text-xs text-zinc-500">
          Shared on {snap.generatedAt} via Imotara
        </p>
      </div>

      {/* Dominant mood */}
      <div className="mb-4 rounded-2xl border border-indigo-400/20 bg-indigo-500/8 px-4 py-3 text-center">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-indigo-400/70 mb-1">This week&apos;s tone</p>
        <div className="flex items-center justify-center gap-2">
          <span className="text-2xl">{dominantEmoji}</span>
          <span className="text-sm font-medium text-indigo-300">{dominantLabel}</span>
        </div>
      </div>

      {/* 7-day strip */}
      <div className="mb-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-2">7-day emotions</p>
        <div className="flex items-center justify-between gap-1">
          {snap.week.map((e, i) => {
            const emoji = EMOTION_EMOJI[e.toLowerCase()] ?? "💭";
            const daysAgo = snap.week.length - 1 - i;
            const label = daysAgo === 0 ? "Today" : daysAgo === 1 ? "Yesterday" : `${daysAgo}d ago`;
            return (
              <div key={i} className="flex flex-col items-center gap-0.5">
                <span className="text-xl">{emoji}</span>
                <span className="text-[9px] text-zinc-600">{label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Reflection days */}
      <div className="mb-6 rounded-xl border border-emerald-400/15 bg-emerald-500/5 px-4 py-2.5 text-center">
        <p className="text-[11px] text-zinc-400">
          Reflected on{" "}
          <span className="font-semibold text-emerald-300">{snap.reflectionDays} day{snap.reflectionDays !== 1 ? "s" : ""}</span>{" "}
          this week
        </p>
      </div>

      <p className="text-center text-[11px] text-zinc-600">
        This snapshot was shared privately.{" "}
        <Link href="/" className="text-indigo-400 underline underline-offset-2 hover:text-indigo-300">
          Try Imotara →
        </Link>
      </p>
    </div>
  );
}

export default function FamilyViewPage() {
  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-50">
      <Suspense>
        <SnapshotView />
      </Suspense>
    </div>
  );
}
