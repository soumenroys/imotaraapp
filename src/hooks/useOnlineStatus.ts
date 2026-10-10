// src/hooks/useOnlineStatus.ts
// Lightweight online/offline detection for web.
// Primary: navigator.onLine + browser online/offline events.
// Secondary: periodic HEAD probe to confirm real connectivity (not just LAN without internet).

import { useEffect, useState } from "react";

// Our own endpoint, as a relative path. It only ever runs in an effect, so a
// browser is guaranteed and the path resolves against the current origin.
//
// There used to be a `connectivitycheck.gstatic.com` fallback for when
// window.location.origin was empty. It could not be reached from a browser,
// and asking a third party whether WE are reachable answers the wrong
// question — the same reason mobile dropped its gstatic probe on 2026-09-16.
const PROBE_PATH = "/api/health";

// ⚠️ 15s, not the 3s this used to be. A timeout lands in the catch below and
// is read as OFFLINE, so on a genuinely slow connection every probe failed and
// the person was told they were offline for as long as the network stayed
// poor — worst for the people on the worst networks. Raising it only affects
// black-hole networks; a refused connection or DNS failure still throws at
// once. Mobile's online.ts carries the same value for the same reason.
const PROBE_TIMEOUT_MS = 15_000;
const PROBE_INTERVAL_MS = 15_000;

async function probeOnline(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
    await fetch(PROBE_PATH, { method: "HEAD", signal: controller.signal, cache: "no-store" });
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
    // Declared before the handlers that reset it — a listener registered
    // above a `let` would be a temporal-dead-zone hazard if it ever fired
    // during this effect body.
    let consecutiveFailures = 0;

    // The browser's own events are authoritative — the OS knows. They bypass
    // the confirmation count entirely, in both directions.
    const markOnline = () => { if (mounted) { consecutiveFailures = 0; setIsOnline(true); } };
    const markOffline = () => { if (mounted) setIsOnline(false); };

    window.addEventListener("online", markOnline);
    window.addEventListener("offline", markOffline);

    // 🔴 ONE FAILED PROBE IS NOT EVIDENCE OF A DEAD NETWORK.
    //
    // Reported on mobile 2026-10-10 — "showing offline though the wifi is
    // strongly available" — and this hook had the identical flaw: a single
    // miss called setIsOnline(false). The probe is a real request to
    // /api/health, a serverless function, so a cold start or a momentary
    // stall makes it miss its 15s window while the connection is fine.
    //
    // ⚖️ Same asymmetry the timeout above is justified by: a false "offline"
    // degrades the experience, a false "online" costs seconds. So require the
    // bad news to repeat. At a 15s interval that is ~30s to admit a real
    // outage, and the browser's own `offline` event still flips it instantly
    // when the OS knows — which is the case that actually matters.
    const OFFLINE_CONFIRMATIONS = 2;

    // Initial probe + periodic confirmation
    async function probe() {
      const online = await probeOnline();
      if (!mounted) return;
      if (online) {
        consecutiveFailures = 0;
        setIsOnline(true);
        return;
      }
      consecutiveFailures += 1;
      // ⛔ Hold the previous state until a second probe agrees.
      if (consecutiveFailures >= OFFLINE_CONFIRMATIONS) setIsOnline(false);
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
