// src/components/imotara/SyncStatus.tsx
"use client";

import { useEffect, useState } from "react";
import { useAutoSync } from "@/hooks/useAutoSync";
import type { SyncPhase } from "@/types/history";
import { RefreshCw, WifiOff, CheckCircle2, AlertTriangle } from "lucide-react";

const phaseLabel: Record<SyncPhase, string> = {
  idle: "Idle",
  queueing: "Queueing",
  syncing: "Syncing…",
  resolving: "Resolving conflicts…",
  done: "Up to date",
  error: "Sync error",
  offline: "Offline",
};

export function SyncStatusBar() {
  const { status, forceSync } = useAutoSync();
  const [mounted, setMounted] = useState(false);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  // Choose a stable default icon for SSR, then switch after mount
  const Icon = (() => {
    if (!mounted) return RefreshCw; // deterministic on SSR
    switch (status.phase) {
      case "offline":
        return WifiOff;
      case "error":
      case "resolving":
        return AlertTriangle;
      case "done":
        return CheckCircle2;
      default:
        return RefreshCw;
    }
  })();

  // Only spin when mounted & actually syncing
  const isSpinning = mounted && status.phase === "syncing";

  return (
    <div className="fixed bottom-4 left-1/2 z-40 -translate-x-1/2">
      <div className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white/90 px-4 py-2 text-sm shadow-lg backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/90">
        <Icon
          className={`h-4 w-4 ${isSpinning ? "animate-[spin_1.5s_linear_infinite]" : ""}`}
          data-steady={!isSpinning}
          aria-hidden="true"
        />
        <div className="flex items-center gap-3">
          <span className="font-medium">{phaseLabel[status.phase]}</span>
          <span className="text-zinc-500 dark:text-zinc-400">
            {status.pulled} pulled • {status.pushed} pushed • {status.conflicts} conflicts
          </span>
          {status.lastError && (
            <span className="text-red-600 dark:text-red-400">({status.lastError})</span>
          )}
          <button
            onClick={() => void forceSync()}
            className="rounded-md border px-2 py-1 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800"
          >
            Sync now
          </button>
        </div>
      </div>
    </div>
  );
}
