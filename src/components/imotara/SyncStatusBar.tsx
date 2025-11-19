// src/components/imotara/SyncStatusBar.tsx
'use client';

import { useEffect, useMemo, useState } from "react";
import useSyncHistory, { type SyncState } from "@/hooks/useSyncHistory";

/**
 * Global Sync Status Bar (bottom fixed)
 * Micro–polish:
 * - fade-in when freshly synced
 * - soft hover for the sync button
 * - subtle glass effect background
 */

export default function SyncStatusBar() {
  const sync = useSyncHistory({
    intervalMs: 0,
    runOnMount: false,
  });

  // ⭐ fade-in animation trigger on newly synced state
  const [pulse, setPulse] = useState(false);
  useEffect(() => {
    if (sync.state === "synced") {
      setPulse(true);
      const t = setTimeout(() => setPulse(false), 1000);
      return () => clearTimeout(t);
    }
  }, [sync.state]);

  const { dotClass, label, sub } = useMemo(() => {
    const stateToDot: Record<SyncState, string> = {
      syncing: "bg-blue-500",
      synced: "bg-emerald-500",
      offline: "bg-zinc-400",
      error: "bg-red-500",
      idle: "bg-zinc-400",
    };
    const lc = stateToDot[sync.state] ?? "bg-zinc-400";

    const lbl =
      sync.state === "syncing"
        ? "Syncing"
        : sync.state === "synced"
          ? "Synced"
          : sync.state === "offline"
            ? "Offline"
            : sync.state === "error"
              ? "Error"
              : "Idle";

    let sub = "";
    if (sync.state === "synced" && sync.lastSyncedAt) {
      sub = `Last synced ${new Date(sync.lastSyncedAt).toLocaleTimeString()}`;
    } else if (sync.state === "offline") {
      sub = "Will retry when back online";
    } else if (sync.state === "error" && sync.lastError) {
      sub = sync.lastError;
    }

    return { dotClass: lc, label: lbl, sub };
  }, [sync.state, sync.lastSyncedAt, sync.lastError]);

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-5xl px-6 pb-4 pointer-events-none">
      <div
        className={`pointer-events-auto flex items-center justify-between rounded-2xl border border-zinc-200 px-3 py-2 text-sm shadow-sm backdrop-blur
                    dark:border-zinc-800 
                    bg-white/80 dark:bg-black/60
                    transition-opacity duration-500
                    ${pulse ? "opacity-100" : "opacity-95"}`}
      >
        <div className="flex items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-full ${dotClass}`} />
          <span className="font-medium">{label}</span>
          {sub && (
            <span className="text-zinc-500 dark:text-zinc-400">• {sub}</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={sync.manualSync}
            className="rounded-lg border border-zinc-200 px-2.5 py-1 text-xs 
                       hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900
                       transition-colors"
            title="Force sync now"
          >
            Sync now
          </button>
        </div>
      </div>
    </div>
  );
}
