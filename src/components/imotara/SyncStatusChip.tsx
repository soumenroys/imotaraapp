// src/components/imotara/SyncStatusChip.tsx
"use client";

import React, { useEffect, useState } from "react";
import { RefreshCw, CheckCircle2, AlertTriangle, WifiOff } from "lucide-react";

export type ChipState = "idle" | "syncing" | "synced" | "offline" | "error";

type Props = {
  state: ChipState;
  lastSyncedAt?: number | null;
  conflictsCount?: number;
  pendingCount?: number;
  onSync?: () => void;
  className?: string;
};

function formatTime(ts?: number | null) {
  if (!ts) return "";
  try {
    const d = new Date(ts);
    return d.toLocaleTimeString();
  } catch {
    return "";
  }
}

export default function SyncStatusChip({
  state,
  lastSyncedAt,
  conflictsCount = 0,
  pendingCount = 0,
  onSync,
  className = "",
}: Props) {
  const isDanger = state === "error";
  const isWarn = state === "offline";
  const isBusy = state === "syncing";

  // Soft synced pulse
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    if (state === "synced") {
      setPulse(true);
      const t = setTimeout(() => setPulse(false), 1500);
      return () => clearTimeout(t);
    }
  }, [state]);

  const base =
    "relative inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs bg-white/80 backdrop-blur-sm shadow-sm dark:bg-zinc-900/70";

  const theme = isDanger
    ? "border-red-500/40 text-red-700 dark:text-red-300"
    : isWarn
      ? "border-yellow-500/40 text-yellow-700 dark:text-yellow-300"
      : isBusy
        ? "border-zinc-300 text-zinc-700 dark:border-zinc-700 dark:text-zinc-300"
        : "border-zinc-300 text-zinc-700 dark:border-zinc-700 dark:text-zinc-300";

  const pulseClass = pulse
    ? "before:absolute before:inset-0 before:rounded-full before:bg-emerald-400/15 before:animate-pulse-soft"
    : "";

  const Icon =
    state === "error"
      ? AlertTriangle
      : state === "offline"
        ? WifiOff
        : state === "synced"
          ? CheckCircle2
          : RefreshCw;

  const title =
    state === "synced" && lastSyncedAt
      ? `All changes saved at ${formatTime(lastSyncedAt)}`
      : state === "offline"
        ? "Offline — will retry when online"
        : state === "syncing"
          ? "Sync in progress"
          : state === "error"
            ? "Last sync failed"
            : "Idle";

  // Clamp counts just in case
  const safeConflicts = Math.max(0, conflictsCount || 0);
  const safePending = Math.max(0, pendingCount || 0);

  // Purely visual: whether the chip can be clicked to trigger sync
  const isClickable = !!onSync && !isBusy;
  const wrapperInteractive = isClickable
    ? "cursor-pointer transition-shadow transition-colors transition-transform hover:shadow-[0_0_14px_rgba(56,189,248,0.45)] hover:border-sky-300/70 hover:-translate-y-0.5"
    : "cursor-default";

  return (
    <div
      className={`${base} ${theme} ${pulseClass} ${wrapperInteractive} ${className}`}
      aria-live="polite"
    >
      <button
        type="button"
        onClick={onSync}
        // NOTE: keep existing behavior: only disable when busy and no onSync
        disabled={isBusy && !onSync}
        title={title}
        aria-label={title}
        aria-busy={isBusy ? "true" : "false"}
        className="relative z-10 inline-flex items-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
      >
        <Icon
          className={isBusy ? "animate-spin" : ""}
          size={14}
          aria-hidden="true"
        />
        <span className="capitalize">{state}</span>
        {lastSyncedAt ? (
          <span className="text-zinc-500 dark:text-zinc-400">
            • {formatTime(lastSyncedAt)}
          </span>
        ) : null}
      </button>

      {/* Conflict badge */}
      {safeConflicts > 0 && (
        <span
          title={`${safeConflicts} pending conflict${safeConflicts > 1 ? "s" : ""
            }`}
          className="ml-2 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold text-white shadow-sm"
        >
          {safeConflicts}
        </span>
      )}

      {/* Pending badge */}
      {safePending > 0 && (
        <span
          title={`${safePending} pending local item${safePending > 1 ? "s" : ""
            }`}
          className="ml-2 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-700 shadow-sm dark:bg-zinc-800 dark:text-zinc-300"
        >
          {safePending} pending
        </span>
      )}
    </div>
  );
}
