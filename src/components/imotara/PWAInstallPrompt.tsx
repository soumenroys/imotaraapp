// src/components/imotara/PWAInstallPrompt.tsx
// Shows a subtle "Add to Home Screen" prompt once, after 30s of engagement.
"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";

const DISMISSED_KEY = "imotara.pwaPromptDismissed.v1";

export default function PWAInstallPrompt() {
  const [prompt, setPrompt] = useState<any>(null);
  const [visible, setVisible] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    // Don't show if already dismissed or already running as PWA
    try {
      if (localStorage.getItem(DISMISSED_KEY)) return;
    } catch { /* ignore */ }

    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;
    if (isStandalone) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setPrompt(e);
      // Show after 30s of engagement
      setTimeout(() => setVisible(true), 30_000);
    };

    window.addEventListener("beforeinstallprompt", handler as any);
    window.addEventListener("appinstalled", () => setInstalled(true));
    return () => window.removeEventListener("beforeinstallprompt", handler as any);
  }, []);

  function dismiss() {
    setVisible(false);
    try { localStorage.setItem(DISMISSED_KEY, "1"); } catch { /* ignore */ }
  }

  async function install() {
    if (!prompt) return;
    prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === "accepted") setInstalled(true);
    dismiss();
  }

  if (!visible || installed || !prompt) return null;

  return (
    <div
      role="dialog"
      aria-label="Add Imotara to your home screen"
      className="fixed bottom-20 right-4 z-50 max-w-[280px] rounded-2xl border border-white/10 bg-black/85 px-4 py-3 shadow-xl backdrop-blur-xl animate-slide-up sm:bottom-6"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 via-sky-500 to-emerald-400 text-xs font-bold text-white shadow">
          io
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-zinc-100">Add to Home Screen</p>
          <p className="mt-0.5 text-[11px] text-zinc-400 leading-snug">
            Use Imotara offline, anytime — like a native app.
          </p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={install}
              className="im-cta-bg flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-medium text-black shadow transition hover:brightness-110"
            >
              <Download className="h-3 w-3" />
              Install
            </button>
            <button
              type="button"
              onClick={dismiss}
              className="rounded-full border border-white/15 px-3 py-1 text-[11px] text-zinc-400 transition hover:bg-white/10"
            >
              Not now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
