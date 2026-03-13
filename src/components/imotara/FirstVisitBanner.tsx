// src/components/imotara/FirstVisitBanner.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { saveConsentMode } from "@/lib/imotara/analysisConsent";

const CONSENT_KEY = "imotara.analysisConsent.v1";
const ONBOARDED_KEY = "imotara.onboarded.v1";

export default function FirstVisitBanner() {
  const [step, setStep] = useState<"consent" | "setup" | "done">("done");
  const router = useRouter();

  useEffect(() => {
    try {
      const consented = window.localStorage.getItem(CONSENT_KEY);
      const onboarded = window.localStorage.getItem(ONBOARDED_KEY);
      if (!consented) setStep("consent");
      else if (!onboarded) setStep("setup");
    } catch {
      // localStorage unavailable — don't show
    }
  }, []);

  if (step === "done") return null;

  function choose(mode: "local-only" | "allow-remote") {
    saveConsentMode(mode);
    setStep("setup");
  }

  function dismissSetup() {
    try {
      window.localStorage.setItem(ONBOARDED_KEY, "1");
    } catch {}
    setStep("done");
  }

  function goToSettings() {
    try {
      window.localStorage.setItem(ONBOARDED_KEY, "1");
    } catch {}
    setStep("done");
    router.push("/settings");
  }

  if (step === "consent") {
    return (
      <div
        role="dialog"
        aria-modal="false"
        aria-label="Privacy and data notice"
        className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-black/90 backdrop-blur-xl px-4 py-5 shadow-[0_-8px_40px_rgba(0,0,0,0.6)]"
      >
        <div className="mx-auto flex max-w-3xl flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
          <div className="flex-1 text-sm text-zinc-300">
            <p className="font-medium text-zinc-100">
              Your conversations stay on your device by default.
            </p>
            <p className="mt-1 text-zinc-400">
              Imotara is local-first — no account needed, nothing leaves your
              browser unless you choose to enable AI replies (which use OpenAI).
              No ads, no tracking, no data sales.{" "}
              <Link
                href="/privacy"
                className="underline underline-offset-2 hover:text-zinc-200"
              >
                Privacy policy
              </Link>
            </p>
          </div>
          <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
            <button
              onClick={() => choose("allow-remote")}
              className="rounded-full bg-gradient-to-r from-indigo-500 to-sky-400 px-5 py-2 text-sm font-medium text-black shadow transition hover:brightness-110 hover:-translate-y-0.5"
            >
              Enable AI replies
            </button>
            <button
              onClick={() => choose("local-only")}
              className="rounded-full border border-white/20 px-5 py-2 text-sm text-zinc-300 transition hover:bg-white/10 hover:-translate-y-0.5"
            >
              Keep it local
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Step 2: nudge toward companion setup
  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label="Personalize your companion"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-black/90 backdrop-blur-xl px-4 py-5 shadow-[0_-8px_40px_rgba(0,0,0,0.6)]"
    >
      <div className="mx-auto flex max-w-3xl flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
        <div className="flex-1 text-sm text-zinc-300">
          <p className="font-medium text-zinc-100">
            Want to personalize your companion?
          </p>
          <p className="mt-1 text-zinc-400">
            Give your companion a name, relationship style, and age range — it
            shapes how Imotara speaks with you. Takes about 30 seconds.
          </p>
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
          <button
            onClick={goToSettings}
            className="rounded-full bg-gradient-to-r from-indigo-500 to-sky-400 px-5 py-2 text-sm font-medium text-black shadow transition hover:brightness-110 hover:-translate-y-0.5"
          >
            Set it up →
          </button>
          <button
            onClick={dismissSetup}
            className="rounded-full border border-white/20 px-5 py-2 text-sm text-zinc-300 transition hover:bg-white/10 hover:-translate-y-0.5"
          >
            Maybe later
          </button>
        </div>
      </div>
    </div>
  );
}
