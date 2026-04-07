"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { isWithinLaunchOffer, getLaunchOfferEndsAt } from "@/lib/imotara/license";

function IconChat(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path
        d="M7.5 18.5 4 20V6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7A2.5 2.5 0 0 1 17.5 16H9.2a2 2 0 0 0-1.0.27l-.7.4v1.83Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M8 8.5h8M8 11.5h6"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconTimeline(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path
        d="M5 7.5h14M5 16.5h14"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M7.5 12a2 2 0 1 0 0 .01V12ZM16.5 12a2 2 0 1 0 0 .01V12Z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="M9.5 12h5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconConsent(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path
        d="M12 3.5c3.5 2.1 6.7 2.5 8 2.7v7.1c0 5.1-3.8 7.8-8 9.1-4.2-1.3-8-4-8-9.1V6.2c1.3-.2 4.5-.6 8-2.7Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="m9.2 12.3 1.9 1.9 3.9-4.2"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconChevron(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path
        d="M9 6l6 6-6 6"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function Home() {
  // First-visit pulse on the Basics tile (only once per browser)
  const [pulseBasics, setPulseBasics] = useState(false);
  const [launchBanner, setLaunchBanner] = useState<{ show: boolean; endsAt: string | null }>({
    show: false,
    endsAt: null,
  });

  useEffect(() => {
    try {
      const key = "imotara_home_basics_seen_v1";
      const seen = window.localStorage.getItem(key);
      if (!seen) {
        window.localStorage.setItem(key, "1");
        const t1 = window.setTimeout(() => setPulseBasics(true), 0);
        const t2 = window.setTimeout(() => setPulseBasics(false), 4200);
        return () => { window.clearTimeout(t1); window.clearTimeout(t2); };
      }
    } catch {
      // ignore (private mode / storage blocked)
    }
  }, []);

  useEffect(() => {
    if (isWithinLaunchOffer()) {
      const endsAt = getLaunchOfferEndsAt();
      const banner = {
        show: true,
        endsAt: endsAt
          ? endsAt.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })
          : null,
      };
      const t = window.setTimeout(() => setLaunchBanner(banner), 0);
      return () => window.clearTimeout(t);
    }
  }, []);

  return (
    <section className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-5xl items-center px-4 py-16 sm:py-24">
      <div className="w-full space-y-10">
        {/* Hero glass card */}
        <div className="imotara-glass-card px-6 py-8 sm:px-8 sm:py-10">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.25em] text-zinc-400">
            <span>Imotara · Emotional Companion</span>
          </div>

          <h1 className="mt-4 text-left text-4xl font-semibold tracking-tight text-zinc-50 sm:text-5xl">
            An Immortal Friend
            <br />
            <span className="bg-gradient-to-r from-indigo-300 via-sky-300 to-emerald-200 bg-clip-text text-transparent">
              for Your Emotions
            </span>
          </h1>

          <p className="mt-5 max-w-xl text-left text-base leading-7 text-zinc-300 sm:text-lg">
            Imotara listens quietly, remembers gently, and reflects your
            emotional patterns back to you — without judgment, and with deep
            respect for your privacy.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/chat"
                className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-gradient-to-r from-indigo-500 via-sky-500 to-emerald-400 px-6 py-3 text-sm font-medium text-white shadow-lg shadow-sky-900/40 transition hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-indigo-400/70 focus:ring-offset-2 focus:ring-offset-transparent"
                aria-label="Get started chatting with Imotara"
              >
                <span>Get Started</span>
                <span className="text-xs opacity-80">/chat</span>
              </Link>

              <Link
                href="/history"
                className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-medium text-zinc-100 shadow-sm transition hover:bg-white/10"
                aria-label="Open your emotion history"
              >
                <span>View History</span>
                <span className="text-[11px] opacity-70">timeline</span>
              </Link>
            </div>

            <p className="max-w-sm text-xs text-zinc-400">
              Local-first by default. Your words are stored in this browser. Remote
              analysis happens only if you explicitly allow it in settings.
            </p>
          </div>
        </div>

        {/* Launch offer banner — client-rendered only */}
        {launchBanner.show && (
          <div className="flex items-start gap-3 rounded-2xl border border-indigo-400/30 bg-indigo-500/10 px-5 py-4 backdrop-blur-sm">
            <span className="mt-0.5 text-lg leading-none">🎁</span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-indigo-200">
                Launch offer — full access is free right now
              </p>
              <p className="mt-0.5 text-xs text-indigo-300/80">
                All features unlocked for every user
                {launchBanner.endsAt ? ` until ${launchBanner.endsAt}` : ""}.
                No account needed.
              </p>
            </div>
            <Link
              href="/settings"
              className="shrink-0 rounded-full border border-indigo-400/30 bg-indigo-500/20 px-3 py-1 text-[11px] font-medium text-indigo-200 transition hover:bg-indigo-500/30"
            >
              Details
            </Link>
          </div>
        )}

        {/* Secondary feature strip */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="imotara-glass-soft p-4">
            <h2 className="flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">
              <span>Chat</span>
            </h2>
            <p className="mt-2 text-sm text-zinc-300">
              Share anything — Imotara responds with gentle, contextual
              reflections within a simple, private chat space.
            </p>
            <Link
              href="/chat"
              className="mt-3 inline-block text-[11px] font-medium text-sky-300 underline-offset-2 hover:underline"
            >
              Open chat →
            </Link>
          </div>

          <div className="imotara-glass-soft p-4">
            <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">
              Emotion History
            </h2>
            <p className="mt-2 text-sm text-zinc-300">
              See how your feelings shift over days and weeks with a calm
              timeline, summary card, and mini-visualizations.
            </p>
            <Link
              href="/history"
              className="mt-3 inline-block text-[11px] font-medium text-emerald-300 underline-offset-2 hover:underline"
            >
              View history →
            </Link>
          </div>

          <div className="imotara-glass-soft p-4">
            <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">
              Consent First
            </h2>
            <p className="mt-2 text-sm text-zinc-300">
              Start fully on-device by default. When you are ready, enable
              remote analysis with a single toggle — you stay in control.
            </p>
            <p className="mt-3 text-[11px] text-zinc-400">
              Analysis mode is shared between Chat and History, so your choice
              applies everywhere.
            </p>
          </div>

          <div className="imotara-glass-soft p-4">
            <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">
              Grow
            </h2>
            <p className="mt-2 text-sm text-zinc-300">
              Daily reflection prompts that gently guide you to notice patterns,
              celebrate small wins, and grow with intention.
            </p>
            <Link
              href="/grow"
              className="mt-3 inline-block text-[11px] font-medium text-violet-300 underline-offset-2 hover:underline"
            >
              Open Grow →
            </Link>
          </div>
        </div>

        {/* Basics wide tile */}
        <div
          className={[
            "imotara-glass-soft relative overflow-hidden p-0",
            pulseBasics ? "imotara-first-visit-pulse" : "",
          ].join(" ")}
        >
          {/* subtle gradient highlight line + micro sweep animation */}
          <div className="imotara-sweep-line h-[2px] w-full" />

          <div className="p-5 sm:p-6">
            <div className="w-full">
              <div className="w-full">
                <div className="flex items-center gap-2">
                  <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">
                    Imotara Basics
                  </h2>
                  <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-semibold text-zinc-200 ring-1 ring-white/10">
                    30-second quick start
                  </span>
                </div>

                <p className="mt-2 text-sm text-zinc-300 lg:whitespace-nowrap lg:overflow-hidden lg:text-ellipsis">
                  Imotara is a private emotional companion that helps you notice
                  patterns, reflect gently, and build clarity — without
                  judgement.
                </p>

                {/* Desktop: keep 2-column layout */}
                <div className="mt-4 hidden gap-4 md:grid md:grid-cols-2">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
                      Why it’s different
                    </div>

                    <ul className="mt-3 space-y-3 text-sm text-zinc-300">
                      <li className="flex items-start gap-3">
                        <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-sky-200">
                          <IconChat className="h-4 w-4" />
                        </span>
                        <span>
                          Not social media — no feed, likes, followers, or
                          public performance.
                        </span>
                      </li>

                      <li className="flex items-start gap-3">
                        <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-emerald-200">
                          <IconTimeline className="h-4 w-4" />
                        </span>
                        <span>
                          Not a generic chatbot — it reflects your patterns over
                          time with history and timeline.
                        </span>
                      </li>

                      <li className="flex items-start gap-3">
                        <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-indigo-200">
                          <IconConsent className="h-4 w-4" />
                        </span>
                        <span>
                          Privacy-first by design — local-first by default,
                          remote analysis only with consent.
                        </span>
                      </li>
                    </ul>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
                      How to use it
                    </div>

                    <ol className="mt-3 space-y-3 text-sm text-zinc-300">
                      <li className="flex items-start gap-3">
                        <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-sky-200">
                          <IconChat className="h-4 w-4" />
                        </span>
                        <span>
                          Start a chat — write what’s on your mind (even short
                          notes count).
                        </span>
                      </li>

                      <li className="flex items-start gap-3">
                        <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-emerald-200">
                          <IconTimeline className="h-4 w-4" />
                        </span>
                        <span>
                          Review Mood Summary + History timeline to see shifts
                          over days and weeks.
                        </span>
                      </li>

                      <li className="flex items-start gap-3">
                        <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-indigo-200">
                          <IconConsent className="h-4 w-4" />
                        </span>
                        <span>
                          If needed, enable remote analysis in Settings — your
                          choice applies everywhere.
                        </span>
                      </li>
                    </ol>
                  </div>
                </div>

                {/* Mobile: accordion */}
                <div className="mt-4 space-y-3 md:hidden">
                  <details className="group rounded-2xl border border-white/10 bg-white/[0.03]">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4">
                      <div className="flex items-center gap-3">
                        <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-emerald-200">
                          <IconTimeline className="h-4 w-4" />
                        </span>
                        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
                          Why it’s different
                        </span>
                      </div>
                      <IconChevron className="h-4 w-4 text-zinc-400 transition group-open:rotate-90" />
                    </summary>

                    <div className="px-4 pb-4">
                      <ul className="space-y-3 text-sm text-zinc-300">
                        <li className="flex items-start gap-3">
                          <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-sky-200">
                            <IconChat className="h-4 w-4" />
                          </span>
                          <span>
                            Not social media — no feed, likes, followers, or
                            public performance.
                          </span>
                        </li>

                        <li className="flex items-start gap-3">
                          <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-emerald-200">
                            <IconTimeline className="h-4 w-4" />
                          </span>
                          <span>
                            Not a generic chatbot — it reflects your patterns
                            over time with history and timeline.
                          </span>
                        </li>

                        <li className="flex items-start gap-3">
                          <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-indigo-200">
                            <IconConsent className="h-4 w-4" />
                          </span>
                          <span>
                            Privacy-first by design — local-first by default,
                            remote analysis only with consent.
                          </span>
                        </li>
                      </ul>
                    </div>
                  </details>

                  <details className="group rounded-2xl border border-white/10 bg-white/[0.03]">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4">
                      <div className="flex items-center gap-3">
                        <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-sky-200">
                          <IconChat className="h-4 w-4" />
                        </span>
                        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
                          How to use it
                        </span>
                      </div>
                      <IconChevron className="h-4 w-4 text-zinc-400 transition group-open:rotate-90" />
                    </summary>

                    <div className="px-4 pb-4">
                      <ol className="space-y-3 text-sm text-zinc-300">
                        <li className="flex items-start gap-3">
                          <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-sky-200">
                            <IconChat className="h-4 w-4" />
                          </span>
                          <span>
                            Start a chat — write what’s on your mind (even short
                            notes count).
                          </span>
                        </li>

                        <li className="flex items-start gap-3">
                          <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-emerald-200">
                            <IconTimeline className="h-4 w-4" />
                          </span>
                          <span>
                            Review Mood Summary + History timeline to see shifts
                            over days and weeks.
                          </span>
                        </li>

                        <li className="flex items-start gap-3">
                          <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-indigo-200">
                            <IconConsent className="h-4 w-4" />
                          </span>
                          <span>
                            If needed, enable remote analysis in Settings — your
                            choice applies everywhere.
                          </span>
                        </li>
                      </ol>
                    </div>
                  </details>
                </div>
              </div>
            </div>

            <p className="mt-4 text-[11px] text-zinc-400">
              Tip: You can stay fully local. Turn on remote analysis only if you
              want deeper AI reflections.
            </p>
          </div>
        </div>

        {/* Get the app */}
        <div className="imotara-glass-soft px-5 py-6 sm:px-8">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
            Get the app
          </p>
          <p className="mt-1.5 text-sm text-zinc-300">
            Take Imotara with you — voice input, offline support, and mood trends on mobile.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <a
              href="https://play.google.com/store/apps/details?id=com.imotara.imotara"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Get Imotara on Google Play"
              className="group flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 transition hover:border-white/20 hover:bg-white/10"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-700/60 to-sky-700/60 text-emerald-200 shadow-sm transition group-hover:from-emerald-600/70 group-hover:to-sky-600/70">
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
                  <path d="M3.18 23.76a2 2 0 0 0 2.05-.22l11.59-6.7-2.83-2.83-10.81 9.75ZM.5 1.05A2 2 0 0 0 0 2.4v19.2a2 2 0 0 0 .5 1.35L.6 23l10.76-10.76v-.25L.6 1.13l-.1-.08ZM20.33 10.54l-2.77-1.6-3.15 3.14 3.15 3.15 2.79-1.61a2.01 2.01 0 0 0 0-3.08ZM3.18.24 13.99 6.94l-2.83 2.83L.6 1.05l.07-.07A2 2 0 0 1 3.18.24Z"/>
                </svg>
              </span>
              <div className="leading-tight">
                <p className="text-[9px] uppercase tracking-[0.15em] text-zinc-500">Get it on</p>
                <p className="text-xs font-semibold text-zinc-200">Google Play</p>
              </div>
            </a>

            <a
              href="https://apps.apple.com/app/imotara/id6756697569"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Download Imotara on the App Store"
              className="group flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 transition hover:border-white/20 hover:bg-white/10"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-zinc-700 to-zinc-800 text-zinc-200 shadow-sm transition group-hover:from-zinc-600 group-hover:to-zinc-700">
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
                  <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11Z"/>
                </svg>
              </span>
              <div className="leading-tight">
                <p className="text-[9px] uppercase tracking-[0.15em] text-zinc-500">Download on the</p>
                <p className="text-xs font-semibold text-zinc-200">App Store</p>
              </div>
            </a>
          </div>
        </div>

        {/* Language switcher */}
        <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-500">
          <span>Also available in:</span>
          <Link href="/hi" className="text-zinc-400 underline-offset-2 hover:text-zinc-200 hover:underline" hrefLang="hi">हिंदी</Link>
          <Link href="/bn" className="text-zinc-400 underline-offset-2 hover:text-zinc-200 hover:underline" hrefLang="bn">বাংলা</Link>
          <Link href="/ta" className="text-zinc-400 underline-offset-2 hover:text-zinc-200 hover:underline" hrefLang="ta">தமிழ்</Link>
        </div>

        {/* IMPORTANT: plain <style> (NOT style jsx) to avoid hydration mismatch */}
        <style>{`
          .imotara-sweep-line {
            background: linear-gradient(
              90deg,
              rgba(129, 140, 248, 0.55),
              rgba(125, 211, 252, 0.5),
              rgba(110, 231, 183, 0.55),
              rgba(125, 211, 252, 0.42),
              rgba(129, 140, 248, 0.5)
            );
            background-size: 220% 100%;
            animation: imotaraSweep 9s ease-in-out infinite;
            box-shadow: 0 0 18px rgba(125, 211, 252, 0.18);
            filter: saturate(1.05);
          }

          @keyframes imotaraSweep {
            0% {
              background-position: 0% 50%;
              opacity: 0.7;
            }
            50% {
              background-position: 100% 50%;
              opacity: 1;
            }
            100% {
              background-position: 0% 50%;
              opacity: 0.75;
            }
          }

          .imotara-first-visit-pulse {
            animation: imotaraPulse 1.6s ease-in-out 0s 2;
          }

          @keyframes imotaraPulse {
            0% {
              box-shadow: 0 0 0 0 rgba(125, 211, 252, 0);
              transform: translateZ(0);
            }
            50% {
              box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.08),
                0 0 28px rgba(125, 211, 252, 0.14);
            }
            100% {
              box-shadow: 0 0 0 0 rgba(125, 211, 252, 0);
            }
          }
        `}</style>
      </div>
    </section>
  );
}
