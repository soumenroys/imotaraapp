'use client';

import type { SyncState } from "@/hooks/useSyncHistory";

type Props = {
  state: SyncState;
  /** UTC ms when last sync completed */
  lastSyncedAt?: number | null;
  /** Optional diagnostic counts (surface when non-zero) */
  pendingCount?: number;
  conflictCount?: number;
  /** Click handler (e.g., open queue/conflicts) */
  onClick?: () => void;
  /** Optional className passthrough */
  className?: string;
};

export default function SyncStatusChip({
  state,
  lastSyncedAt,
  pendingCount = 0,
  conflictCount = 0,
  onClick,
  className = "",
}: Props) {
  const label =
    state === "syncing"
      ? "Syncing"
      : state === "synced"
      ? "Synced"
      : state === "offline"
      ? "Offline"
      : state === "error"
      ? "Error"
      : "Idle";

  const dotClass =
    state === "syncing"
      ? "bg-blue-500"
      : state === "synced"
      ? "bg-emerald-500"
      : state === "offline"
      ? "bg-zinc-400"
      : state === "error"
      ? "bg-red-500"
      : "bg-zinc-400";

  const tooltip =
    state === "synced" && lastSyncedAt
      ? `All changes saved at ${new Date(lastSyncedAt).toLocaleTimeString()}`
      : state === "offline"
      ? "Offline — queued; will retry when online"
      : state === "syncing"
      ? "Sync in progress"
      : state === "error"
      ? "Last sync failed"
      : "Idle";

  return (
    <button
      type="button"
      onClick={onClick}
      title={tooltip}
      className={`inline-flex items-center gap-2 rounded-full border border-zinc-200 px-2.5 py-1 text-xs text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-900 ${className}`}
    >
      <span className={`h-2 w-2 rounded-full ${dotClass}`} />
      <span>{label}</span>

      {conflictCount > 0 && (
        <span className="ml-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
          {conflictCount} conflict{conflictCount > 1 ? "s" : ""}
        </span>
      )}

      {pendingCount > 0 && (
        <span className="ml-1 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
          {pendingCount} pending
        </span>
      )}
    </button>
  );
}
