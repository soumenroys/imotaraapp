// src/hooks/useAutoSync.ts
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { runBidirectionalSync } from "@/lib/imotara/syncManager";
import type { SyncSummary } from "@/types/history";

const DEFAULT_INTERVAL_MS = 45_000; // 45s
const VISIBILITY_BACKOFF_MS = 3_000; // quick sync after tab becomes visible

export function useAutoSync(intervalMs = DEFAULT_INTERVAL_MS) {
  // IMPORTANT: start with a deterministic SSR-safe state (no navigator.onLine here)
  const [status, setStatus] = useState<SyncSummary>({
    phase: "idle",
    queued: 0,
    pushed: 0,
    pulled: 0,
    conflicts: 0,
  });

  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<number | null>(null);
  const mountedRef = useRef(false);

  const doSync = useCallback(async () => {
    // Only check navigator.onLine AFTER mount on the client
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setStatus((s) => ({ ...s, phase: "offline" }));
      return;
    }
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    try {
      await runBidirectionalSync(
        (patch) => setStatus((s) => ({ ...s, ...patch })),
        { signal: abortRef.current.signal }
      );
    } catch {
      // status already updated inside runBidirectionalSync on error/offline
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    // Immediately reconcile online/offline AFTER mount to avoid SSR mismatch
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setStatus((s) => ({ ...s, phase: "offline" }));
    } else {
      setStatus((s) => ({ ...s, phase: "idle" }));
      void doSync(); // optional eager first sync
    }

    // interval loop
    const kick = () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      timerRef.current = window.setInterval(doSync, intervalMs) as unknown as number;
    };
    kick();

    return () => {
      mountedRef.current = false;
      if (timerRef.current) window.clearInterval(timerRef.current);
      abortRef.current?.abort();
    };
  }, [doSync, intervalMs]);

  useEffect(() => {
    const onOnline = () => {
      setStatus((s) => ({ ...s, phase: "idle" }));
      void doSync();
    };
    const onOffline = () =>
      setStatus((s) => ({ ...s, phase: "offline" }));

    if (typeof window !== "undefined") {
      window.addEventListener("online", onOnline);
      window.addEventListener("offline", onOffline);
    }
    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("online", onOnline);
        window.removeEventListener("offline", onOffline);
      }
    };
  }, [doSync]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible") {
        setTimeout(() => void doSync(), VISIBILITY_BACKOFF_MS);
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [doSync]);

  return { status, forceSync: doSync };
}
