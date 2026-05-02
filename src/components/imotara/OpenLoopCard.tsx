// src/components/imotara/OpenLoopCard.tsx
// P1 — Emotional Open Loops banner shown above the chat input.

"use client";

import { Infinity as InfinityIcon, X } from "lucide-react";
import type { OpenLoop } from "@/lib/imotara/openLoops";

type Props = {
  loop: OpenLoop;
  onExplore: () => void;
  onDefer: () => void;
  onDismiss: () => void;
};

export default function OpenLoopCard({ loop, onExplore, onDefer, onDismiss }: Props) {
  return (
    <div className="mx-3 mb-2 rounded-xl border border-amber-500/25 bg-amber-500/6 px-3 py-2.5">
      {/* Header */}
      <div className="mb-1.5 flex items-center gap-1.5">
        <InfinityIcon className="h-3.5 w-3.5 shrink-0 text-amber-400" />
        <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-400">
          Open loop · {loop.themeName}
        </span>
        <button
          onClick={onDismiss}
          className="ml-auto text-zinc-500 hover:text-zinc-300 transition"
          aria-label="Dismiss"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Prompt */}
      <p className="mb-2.5 text-sm leading-snug text-zinc-300">
        I've noticed <span className="font-semibold text-zinc-200">{loop.themeName}</span> has come up across{" "}
        {loop.threadCount} conversations. Want to sit with it together?
      </p>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={onExplore}
          className="flex-1 rounded-full border border-amber-500/40 bg-amber-500/15 py-1.5 text-xs font-semibold text-amber-300 transition hover:bg-amber-500/25"
        >
          Open a thread for this
        </button>
        <button
          onClick={onDefer}
          className="rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs text-zinc-500 transition hover:text-zinc-300"
        >
          Later
        </button>
      </div>
    </div>
  );
}
