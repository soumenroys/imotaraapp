// src/hooks/useSyncHistory.ts
import { useCallback, useEffect, useRef, useState } from "react";
import type { EmotionRecord } from "@/types/history";
import type { Conflict, SyncPlan } from "@/types/sync";
import { syncHistoryStep } from "@/lib/imotara/syncHistory";
import { getSyncState } from "@/lib/imotara/historyPersist";

export type SyncState = "idle" | "syncing" | "synced" | "offline" | "error";

type UseSyncHistoryOptions = {
  /** Optional: caller gets the latest local array after a sync (for custom stores). */
  onPersist?: (merged: EmotionRecord[]) => Promise<void> | void;
  /** How often to auto-sync (ms). Default: 60s */
  intervalMs?: number;
  /** Immediate sync on mount. Default: true */
  runOnMount?: boolean;
};

export default function useSyncHistory(options: UseSyncHistoryOptions = {}) {
  const { onPersist, intervalMs = 60_000, runOnMount = true } = options;

  // public state (kept similar to your original)
  const [state, setState] = useState<SyncState>("idle");
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [remoteCount, setRemoteCount] = useState<number>(0); // derived from plan.applyRemote
  const [syncToken, setSyncToken] = useState<string | undefined>(undefined);
  const [isSyncing, setIsSyncing] = useState(false);

  // extra debug / next-step UI surfaces
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [lastPlan, setLastPlan] = useState<SyncPlan | null>(null);

  // lifecyle guards
  const inFlightRef = useRef(false);
  const mountedRef = useRef(false);

  const doSync = useCallback(async () => {
    if (inFlightRef.current) return; // prevent overlap

    // Offline short-circuit (still allow manual tries if you want—here we skip)
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      setState("offline");
      return;
    }

    inFlightRef.current = true;
    setIsSyncing(true);
    setState("syncing");
    setLastError(null);

    try {
      // One conservative sync step (pull delta, plan, apply safe changes, persist state)
      const { plan, local } = await syncHistoryStep();
      if (!mountedRef.current) return;

      setLastPlan(plan);
      setConflicts(plan.conflicts);
      setRemoteCount(plan.applyRemote.length); // diagnostic: how many came from server this step

      // expose for external stores (optional)
      if (onPersist) {
        await onPersist(local);
        if (!mountedRef.current) return;
      }

      const s = getSyncState();
      setLastSyncedAt(s.lastSyncedAt ?? null);
      setSyncToken((s.syncToken ?? undefined) as string | undefined);

      setState("synced");
    } catch (err: any) {
      if (!mountedRef.current) return;
      setState("error");
      setLastError(String(err?.message ?? err));
    } finally {
      inFlightRef.current = false;
      setIsSyncing(false);
    }
  }, [onPersist]);

  // Manual trigger (kept name similar to your earlier API)
  const manualSync = useCallback(async () => {
    await doSync();
  }, [doSync]);

  // Mount / unmount
  useEffect(() => {
    mountedRef.current = true;

    if (runOnMount) {
      doSync();
    }

    // initialize token from persisted state (useful for debug)
    const s = getSyncState();
    setSyncToken((s.syncToken ?? undefined) as string | undefined);
    setLastSyncedAt(s.lastSyncedAt ?? null);

    return () => {
      mountedRef.current = false;
    };
  }, [doSync, runOnMount]);

  // Re-sync on tab visibility
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        doSync();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [doSync]);

  // Re-sync when network comes back
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
    // actions
    manualSync,   // (was your manual trigger)
    runSync: doSync, // alias for clarity going forward

    // state (kept similar to your existing surfaces)
    state,
    isSyncing,
    lastSyncedAt,
    lastError,
    remoteCount,
    syncToken,

    // for upcoming Step 14.2 UI
    conflicts,
    lastPlan,
  };
}
