// src/components/imotara/TopBar.tsx
"use client";

import { useState } from "react";
import useSyncHistory from "@/hooks/useSyncHistory";
import SyncStatusChip from "@/components/imotara/SyncStatusChip";
import ConflictPanel from "@/components/imotara/ConflictPanel";

export default function TopBar() {
  // Use the sync hook you already have
  const { runSync, state, conflicts, lastSyncedAt, isSyncing } = useSyncHistory({
    runOnMount: true,
    intervalMs: 60000, // auto sync every 60s
  });

  // For opening/closing the conflict panel
  const [open, setOpen] = useState(false);

  return (
    <div className="flex items-center justify-between border-b border-zinc-200 bg-white/80 px-4 py-2 backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-900/70">
      <div className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
        Imotara
      </div>

      <div className="flex items-center gap-3">
        <SyncStatusChip
          state={isSyncing ? "syncing" : state}
          lastSyncedAt={lastSyncedAt}
          conflictsCount={conflicts.length}
          onSync={runSync}
        />

        <button
          type="button"
          className="rounded-lg border border-zinc-300 px-3 py-1 text-xs text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
          onClick={() => setOpen(true)}
          disabled={conflicts.length === 0}
          title={conflicts.length ? "Review conflicts" : "No conflicts"}
        >
          Review
        </button>
      </div>

      <ConflictPanel
        open={open}
        conflicts={conflicts}
        onClose={() => setOpen(false)}
        onSubmit={(choices) => {
          // Real "apply" logic can be wired here later
          console.log("User choices:", choices);
          setOpen(false);
        }}
      />
    </div>
  );
}
