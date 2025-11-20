// src/components/imotara/SyncStatusBar.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import useSyncHistory, { type SyncState } from "@/hooks/useSyncHistory";

/**
 * Global Sync Status Bar (bottom fixed)
 * Aurora Calm styling:
 * - glassy bar floating above the gradient background
 * - small glowing status dot
 * - soft fade when freshly synced
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
      syncing: "bg-sky-400",
      synced: "bg-emerald-400",
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
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 mx-auto flex w-full max-w-5xl justify-center px-4 pb-4">
      <div
        className={`pointer-events-auto flex w-full items-center justify-between gap-3 rounded-2xl border border-white/15 bg-white/10 px-3 py-2 text-xs text-zinc-50 shadow-lg shadow-sky-900/30 backdrop-blur-md dark:bg-black/60 transition-opacity duration-500 ${pulse ? "opacity-100" : "opacity-90"
          }`}
      >
        {/* Left: status dot + label */}
        <div className="flex min-w-0 items-center gap-2">
          <span
            className={`h-2.5 w-2.5 rounded-full ${dotClass} shadow-[0_0_8px_rgba(255,255,255,0.4)]`}
          />
          <span className="text-xs font-medium">{label}</span>
          {sub && (
            <span className="hidden truncate text-[11px] text-zinc-300 sm:inline">
              • {sub}
            </span>
          )}
        </div>

        {/* Right: manual sync button */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={sync.manualSync}
            disabled={sync.state === "syncing"}
            className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-3 py-1 text-[11px] font-medium text-zinc-50 shadow-sm transition hover:bg-white/10 disabled:opacity-40"
            title="Force sync now"
          >
            <span
              className={`inline-block h-3 w-3 rounded-full border border-white/40 ${sync.state === "syncing" ? "animate-pulse-soft bg-sky-400" : "bg-transparent"
                }`}
            />
            <span>{sync.state === "syncing" ? "Syncing…" : "Sync now"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
