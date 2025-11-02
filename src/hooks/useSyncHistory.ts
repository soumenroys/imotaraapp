// src/hooks/useSyncHistory.ts
import { useCallback, useEffect, useRef, useState } from "react";
import type { EmotionRecord } from "@/types/history";
import { pullAndMergeFromApi } from "@/lib/imotara/syncHistory";

/**
 * Hook to auto-pull remote history and merge with local, then ask the caller to persist.
 * We do NOT import a setter from your history module (since it's not exported in your repo).
 * Instead, pass an `onPersist` callback that writes the merged array to your store.
 *
 * Example:
 * const sync = useSyncHistory({
 *   onPersist: async (merged) => { /* save to your store * / },
 *   intervalMs: 60000,
 *   runOnMount: true,
 * });
 */

export type SyncState = "idle" | "syncing" | "synced" | "offline" | "error";

type UseSyncHistoryOptions = {
  /** Persist function to store the merged list locally (required for durable sync). */
  onPersist?: (merged: EmotionRecord[]) => Promise<void> | void;
  /** How often to auto-sync (ms). Default: 60s */
  intervalMs?: number;
  /** Pass through to GET /api/history — if you maintain an incremental token externally. */
  initialSyncToken?: string;
  /** Only if you prefer time-based incremental pulls. */
  since?: number;
  /** NEW: run an immediate sync on mount. Default: true */
  runOnMount?: boolean;
};

export function useSyncHistory(options: UseSyncHistoryOptions = {}) {
  const {
    onPersist,
    intervalMs = 60_000,
    initialSyncToken,
    since,
    runOnMount = true,
  } = options;

  const [state, setState] = useState<SyncState>("idle");
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [remoteCount, setRemoteCount] = useState<number>(0);
  const [syncToken, setSyncToken] = useState<string | undefined>(initialSyncToken);

  const inFlightRef = useRef<boolean>(false);
  const abortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef<boolean>(false);

  const doSync = useCallback(async () => {
    if (inFlightRef.current) return; // prevent overlapping runs

    // If browser reports offline, skip (but allow manual trigger to try).
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      setState("offline");
      return;
    }

    inFlightRef.current = true;
    setState("syncing");
    setLastError(null);

    const abort = new AbortController();
    abortRef.current = abort;

    try {
      const { merged, remoteCount, syncToken: newToken } = await pullAndMergeFromApi({
        syncToken,
        since,
        signal: abort.signal,
      });

      // Persist if caller provided a handler; otherwise warn (one time).
      if (onPersist) {
        await onPersist(merged);
      } else {
        // eslint-disable-next-line no-console
        console.warn(
          "[useSyncHistory] No onPersist handler provided — merged history NOT saved. " +
            "Pass onPersist to write merged records to your store."
        );
      }

      if (!mountedRef.current) return;

      setRemoteCount(remoteCount);
      if (newToken) setSyncToken(newToken);
      setState("synced");
      setLastSyncedAt(Date.now());
    } catch (err: any) {
      if (!mountedRef.current) return;
      if (err?.name === "AbortError") {
        // Silent cancel (component unmounted or replaced run)
        inFlightRef.current = false;
        return;
      }
      setState("error");
      setLastError(String(err?.message ?? err));
    } finally {
      inFlightRef.current = false;
      abortRef.current = null;
    }
  }, [onPersist, since, syncToken]);

  // Manual trigger for UI
  const manualSync = useCallback(async () => {
    await doSync();
  }, [doSync]);

  // Setup: initial sync on mount (configurable)
  useEffect(() => {
    mountedRef.current = true;

    if (runOnMount) {
      doSync(); // fire immediately on mount
    }

    return () => {
      mountedRef.current = false;
      // cancel in-flight
      if (abortRef.current) {
        try {
          abortRef.current.abort();
        } catch {
          /* noop */
        }
      }
    };
  }, [doSync, runOnMount]);

  // Re-sync when tab gains focus / page becomes visible
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        doSync();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [doSync]);

  // Re-sync when network comes back online
  useEffect(() => {
    const onOnline = () => doSync();
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [doSync]);

  // Periodic timer
  useEffect(() => {
    if (intervalMs <= 0) return;
    const id = window.setInterval(() => {
      doSync();
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [doSync, intervalMs]);

  return {
    /** Overall sync state for a small UI chip. */
    state,
    /** UTC ms timestamp when we last fully synced (push not handled here). */
    lastSyncedAt,
    /** Most recent fetch/merge error (if any). */
    lastError,
    /** Count of remote records received in the last pull (diagnostic). */
    remoteCount,
    /** Current incremental token (if your API returns one). */
    syncToken,
    /** Call to trigger a sync manually (e.g., button click). */
    manualSync,
  };
}

export default useSyncHistory;
