// src/hooks/useOnlineStatus.ts
// Lightweight online/offline detection for web.
// Primary: navigator.onLine + browser online/offline events.
// Secondary: periodic HEAD probe to confirm real connectivity (not just LAN without internet).

import { useEffect, useState } from "react";

// Primary probe endpoint: use our own server if available (more reliable than 3rd-party probes).
// Fallback to Google connectivity check when needed.
const PROBE_URL =
  (typeof window !== "undefined" && window.location.origin
    ? `${window.location.origin}/api/health`
    : "") || "https://connectivitycheck.gstatic.com/generate_204";
const PROBE_TIMEOUT_MS = 3000;
const PROBE_INTERVAL_MS = 15_000;

async function probeOnline(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
    await fetch(PROBE_URL, { method: "HEAD", signal: controller.signal, cache: "no-store" });
    clearTimeout(timer);
    return true; // any HTTP response (even 5xx) means network is up; only thrown exceptions mean offline
  } catch {
    return false;
  }
}

export function useOnlineStatus(): boolean {
  // Always start true (matches server-render default) — sync to real value
  // inside useEffect to avoid SSR/client hydration mismatch.
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    let mounted = true;

    const markOnline = () => { if (mounted) setIsOnline(true); };
    const markOffline = () => { if (mounted) setIsOnline(false); };

    window.addEventListener("online", markOnline);
    window.addEventListener("offline", markOffline);

    // Initial probe + periodic confirmation
    async function probe() {
      const online = await probeOnline();
      if (mounted) setIsOnline(online);
    }

    probe();
    const interval = setInterval(probe, PROBE_INTERVAL_MS);

    return () => {
      mounted = false;
      window.removeEventListener("online", markOnline);
      window.removeEventListener("offline", markOffline);
      clearInterval(interval);
    };
  }, []);

  return isOnline;
}
