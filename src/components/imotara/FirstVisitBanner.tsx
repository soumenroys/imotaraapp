// src/components/imotara/FirstVisitBanner.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { saveConsentMode } from "@/lib/imotara/analysisConsent";

const CONSENT_KEY = "imotara.analysisConsent.v1";
const ONBOARDED_KEY = "imotara.onboarded.v1";

// Paths where user-onboarding banners should never appear
const SUPPRESS_PATHS = ["/admin", "/help"];

export default function FirstVisitBanner() {
  const [show, setShow] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (SUPPRESS_PATHS.some((p) => pathname.startsWith(p))) return;
    try {
      const consented = window.localStorage.getItem(CONSENT_KEY);
      const onboarded = window.localStorage.getItem(ONBOARDED_KEY);
      if (!consented) {
        // Auto-default to cloud on first visit — no choice prompt.
        // User can switch to local-only in Settings at any time.
        saveConsentMode("allow-remote");
      }
      if (!onboarded) setShow(true);
    } catch {
      // localStorage unavailable — don't show
    }
  }, [pathname]);

  if (!show) return null;

  function dismiss() {
    try {
      window.localStorage.setItem(ONBOARDED_KEY, "1");
    } catch {}
    setShow(false);
  }

  function goToSettings() {
    try {
      window.localStorage.setItem(ONBOARDED_KEY, "1");
    } catch {}
    setShow(false);
    router.push("/settings");
  }

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label="Personalize your companion"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-zinc-200 bg-white/95 dark:border-white/10 dark:bg-black/90 backdrop-blur-xl px-4 py-3 sm:py-5 shadow-[0_-8px_40px_rgba(0,0,0,0.25)] dark:shadow-[0_-8px_40px_rgba(0,0,0,0.6)]"
    >
      <div className="mx-auto flex max-w-3xl flex-col gap-2 sm:flex-row sm:items-center sm:gap-6">
        <div className="flex-1 text-sm text-zinc-700 dark:text-zinc-300">
          <p className="font-medium text-zinc-900 dark:text-zinc-100">
            Want to personalize your companion?
          </p>
          <p className="mt-1 hidden text-zinc-600 dark:text-zinc-400 sm:block">
            Give your companion a name, relationship style, and age range — it
            shapes how Imotara speaks with you. Takes about 30 seconds.
          </p>
        </div>
        <div className="flex shrink-0 flex-row gap-2">
          <button
            onClick={goToSettings}
            className="im-cta-bg rounded-full px-4 py-1.5 text-sm font-medium text-black shadow transition hover:brightness-110 hover:-translate-y-0.5"
          >
            Set it up →
          </button>
          <button
            onClick={dismiss}
            className="rounded-full border border-zinc-300 dark:border-white/20 px-4 py-1.5 text-sm text-zinc-700 dark:text-zinc-300 transition hover:bg-zinc-100 dark:hover:bg-white/10 hover:-translate-y-0.5"
          >
            Maybe later
          </button>
        </div>
      </div>
    </div>
  );
}
