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
 *
 * NOW ENHANCED WITH:
 * - Offline detection
 * - “Back online” auto-retry indicator
 * - No change to existing logic, dot colors, or labels
 */

const STATE_TO_DOT: Record<SyncState, string> = {
  syncing: "bg-sky-400",
  synced: "bg-emerald-400",
  offline: "bg-zinc-400",
  error: "bg-red-500",
  idle: "bg-zinc-400",
};

const STATE_TO_LABEL: Record<SyncState, string> = {
  syncing: "Syncing",
  synced: "Synced",
  offline: "Offline",
  error: "Error",
  idle: "Idle",
};

function formatTime(ts?: number | null) {
  if (!ts) return "";
  try {
    return new Date(ts).toLocaleTimeString();
  } catch {
    return "";
  }
}

export default function SyncStatusBar() {
  const sync = useSyncHistory({
    intervalMs: 0,
    runOnMount: false,
  });

  const remoteCount =
    typeof (sync as any)?.remoteCount === "number"
      ? ((sync as any).remoteCount as number)
      : null;

  // ⭐ fade-in animation trigger on newly synced state
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    if (sync.state === "synced") {
      setPulse(true);
      const t = setTimeout(() => setPulse(false), 1000);
      return () => clearTimeout(t);
    }
  }, [sync.state]);

  // ⭐ NEW: browser offline/online indicators
  const [isOffline, setIsOffline] = useState(
    typeof navigator !== "undefined" ? !navigator.onLine : false
  );
  const [justOnline, setJustOnline] = useState(false);

  // Listen to browser connectivity
  useEffect(() => {
    function goOffline() {
      setIsOffline(true);
    }
    function goOnline() {
      setIsOffline(false);
      setJustOnline(true);
      setTimeout(() => setJustOnline(false), 3000);

      // auto-retry queued changes
      sync.manualSync?.();
    }

    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
    };
  }, [sync.manualSync]);

  const { dotClass, label, sub } = useMemo(() => {
    let effectiveState = sync.state;

    // Override visual state when browser offline
    if (isOffline) {
      effectiveState = "offline";
    }

    const dotClass = STATE_TO_DOT[effectiveState] ?? "bg-zinc-400";
    let label = STATE_TO_LABEL[effectiveState] ?? "Idle";

    let sub = "";
    if (effectiveState === "offline") {
      sub = "Will retry when back online";
    } else if (justOnline) {
      label = "Back online";
      sub = "Syncing queued…";
    } else if (effectiveState === "synced" && sync.lastSyncedAt) {
      const t = formatTime(sync.lastSyncedAt);
      sub = t ? `Last synced ${t}` : "Last synced recently";
    } else if (effectiveState === "error" && sync.lastError) {
      sub = sync.lastError;
    }

    if (effectiveState === "synced" && remoteCount != null) {
      const recordsLabel = `${remoteCount} record${remoteCount === 1 ? "" : "s"
        } on server`;
      sub = sub ? `${sub} • ${recordsLabel}` : recordsLabel;
    }

    return { dotClass, label, sub };
  }, [
    sync.state,
    sync.lastSyncedAt,
    sync.lastError,
    remoteCount,
    isOffline,
    justOnline,
  ]);

  const isSyncing = sync.state === "syncing";

  const buttonLabel = isSyncing
    ? "Syncing…"
    : sync.state === "error"
      ? "Retry sync"
      : "Sync now";

  const buttonTitle =
    sync.state === "error"
      ? "Last sync failed — click to retry"
      : "Force sync now";

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 mx-auto flex w-full max-w-5xl justify-center px-4 pb-4">
      <div
        className={`pointer-events-auto flex w-full items-center justify-between gap-3 rounded-2xl border border-white/15 bg-white/12 text-xs text-zinc-50 shadow-lg shadow-sky-900/30 backdrop-blur-md dark:bg-black/65 transition-opacity duration-500 ${pulse ? "opacity-100" : "opacity-90"
          }`}
        aria-label="Imotara sync status"
      >
        {/* Left: status dot + label */}
        <div
          className="flex min-w-0 items-center gap-2"
          role="status"
          aria-live="polite"
        >
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
            disabled={isSyncing}
            aria-busy={isSyncing ? "true" : "false"}
            aria-label={buttonLabel}
            className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-3 py-1 text-[11px] font-medium text-zinc-50 shadow-sm transition hover:bg-white/10 disabled:opacity-40"
            title={buttonTitle}
          >
            <span
              className={`inline-block h-3 w-3 rounded-full border border-white/40 ${isSyncing
                ? "animate-pulse-soft bg-sky-400"
                : "bg-transparent"
                }`}
            />
            <span>{buttonLabel}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
