// src/components/imotara/OfflineIndicator.tsx
"use client";

import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

export default function OfflineIndicator() {
  const [offline, setOffline] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const update = () => {
      const isOffline = !navigator.onLine;
      setOffline(isOffline);
      setVisible(isOffline);
    };
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  // When coming back online, show a brief "back online" state then hide
  useEffect(() => {
    if (!offline && visible) {
      const t = setTimeout(() => setVisible(false), 2500);
      return () => clearTimeout(t);
    }
  }, [offline, visible]);

  if (!visible) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed top-16 left-1/2 z-50 -translate-x-1/2 flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-medium shadow-lg backdrop-blur-xl animate-slide-up transition-all ${
        offline
          ? "border-amber-400/30 bg-amber-500/15 text-amber-200"
          : "border-emerald-400/30 bg-emerald-500/15 text-emerald-200"
      }`}
    >
      {offline ? (
        <>
          <WifiOff className="h-3.5 w-3.5" />
          <span>You&apos;re offline — Imotara is working locally</span>
        </>
      ) : (
        <>
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>Back online</span>
        </>
      )}
    </div>
  );
}
