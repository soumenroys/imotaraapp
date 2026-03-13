// src/components/imotara/ServiceWorkerRegistration.tsx
// #24: Registers the Imotara service worker for offline-first PWA support.
"use client";

import { useEffect } from "react";

export default function ServiceWorkerRegistration() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .catch(() => {
        // SW registration failure is non-fatal — app works without it
      });
  }, []);

  return null;
}
