// src/components/imotara/SyncStatusChip.tsx
'use client';

import React from 'react';
import { RefreshCw, CheckCircle2, AlertTriangle, WifiOff } from 'lucide-react';

export type ChipState = 'idle' | 'syncing' | 'synced' | 'offline' | 'error';

type Props = {
  state: ChipState;
  /** UTC ms when last sync completed */
  lastSyncedAt?: number | null;
  /** Number of pending conflicts (shown as a red badge when > 0) */
  conflictsCount?: number;
  /** Optional diagnostic: pending local items not yet pushed */
  pendingCount?: number;
  /** Click to trigger a manual sync */
  onSync?: () => void;
  /** Optional className passthrough */
  className?: string;
};

function formatTime(ts?: number | null) {
  if (!ts) return '';
  try {
    const d = new Date(ts);
    return d.toLocaleTimeString();
  } catch {
    return '';
  }
}

export default function SyncStatusChip({
  state,
  lastSyncedAt,
  conflictsCount = 0,
  pendingCount = 0,
  onSync,
  className = '',
}: Props) {
  const isDanger = state === 'error';
  const isWarn = state === 'offline';
  const isBusy = state === 'syncing';

  const base =
    'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs';
  const theme = isDanger
    ? 'border-red-500/40 text-red-600 dark:text-red-400'
    : isWarn
    ? 'border-yellow-500/40 text-yellow-700 dark:text-yellow-300'
    : isBusy
    ? 'border-zinc-300 text-zinc-700 dark:border-zinc-700 dark:text-zinc-300'
    : 'border-zinc-300 text-zinc-700 dark:border-zinc-700 dark:text-zinc-300';

  const Icon =
    state === 'error'
      ? AlertTriangle
      : state === 'offline'
      ? WifiOff
      : state === 'synced'
      ? CheckCircle2
      : RefreshCw;

  const title =
    state === 'synced' && lastSyncedAt
      ? `All changes saved at ${formatTime(lastSyncedAt)}`
      : state === 'offline'
      ? 'Offline — will retry when online'
      : state === 'syncing'
      ? 'Sync in progress'
      : state === 'error'
      ? 'Last sync failed'
      : 'Idle';

  return (
    <div className={`${base} ${theme} ${className}`}>
      <button
        type="button"
        onClick={onSync}
        disabled={isBusy && !onSync}
        title={title}
        className="inline-flex items-center gap-2"
      >
        <Icon className={isBusy ? 'animate-spin' : ''} size={14} />
        <span className="capitalize">{state}</span>
        {lastSyncedAt ? (
          <span className="text-zinc-500 dark:text-zinc-400">
            • {formatTime(lastSyncedAt)}
          </span>
        ) : null}
      </button>

      {/* Conflict badge */}
      {conflictsCount > 0 && (
        <span
          title={`${conflictsCount} pending conflict${conflictsCount > 1 ? 's' : ''}`}
          className="ml-2 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold text-white"
        >
          {conflictsCount}
        </span>
      )}

      {/* Optional pending chip */}
      {pendingCount > 0 && (
        <span
          title={`${pendingCount} pending local item${pendingCount > 1 ? 's' : ''}`}
          className="ml-2 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
        >
          {pendingCount} pending
        </span>
      )}
    </div>
  );
}
