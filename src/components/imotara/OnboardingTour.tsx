// src/components/imotara/OnboardingTour.tsx
// #12: 3-slide onboarding tour shown after consent is given
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const TOUR_KEY = "imotara.tour.v1";
const CONSENT_KEY = "imotara.analysisConsent.v1";

type Slide = { emoji: string; title: string; body: string; cta: string; href: string };

const SLIDES: Slide[] = [
  {
    emoji: "💬",
    title: "Chat",
    body: "Talk to Imotara about anything on your mind. Replies adapt to how you feel — no judgement, no ads, no data sold.",
    cta: "Start chatting →",
    href: "/chat",
  },
  {
    emoji: "🌱",
    title: "Grow",
    body: "Answer a daily reflection prompt tailored to your emotional patterns. Build a streak, spot themes, and grow over time.",
    cta: "See today's prompt →",
    href: "/grow",
  },
  {
    emoji: "📖",
    title: "History",
    body: "Your emotion timeline lives here — sorted by day, never shared unless you choose to sync. Export it anytime.",
    cta: "View history →",
    href: "/history",
  },
];

export default function OnboardingTour() {
  const [visible, setVisible] = useState(false);
  const [slide, setSlide] = useState(0);

  useEffect(() => {
    try {
      const consented = window.localStorage.getItem(CONSENT_KEY);
      const toured = window.localStorage.getItem(TOUR_KEY);
      if (consented && !toured) setVisible(true);
    } catch { /* ignore */ }
  }, []);

  function dismiss() {
    try { window.localStorage.setItem(TOUR_KEY, "1"); } catch { /* ignore */ }
    setVisible(false);
  }

  function next() {
    if (slide < SLIDES.length - 1) {
      setSlide((s) => s + 1);
    } else {
      dismiss();
    }
  }

  if (!visible) return null;

  const current = SLIDES[slide];

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label="Quick tour"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-black/90 px-4 py-5 backdrop-blur-xl shadow-[0_-8px_40px_rgba(0,0,0,0.5)]"
    >
      <div className="mx-auto max-w-2xl">
        {/* Slide dots */}
        <div className="mb-3 flex items-center justify-between">
          <div className="flex gap-1.5">
            {SLIDES.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setSlide(i)}
                aria-label={`Slide ${i + 1}`}
                className={`h-1.5 rounded-full transition-all ${
                  i === slide ? "w-4 bg-indigo-400" : "w-1.5 bg-white/20"
                }`}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={dismiss}
            className="text-xs text-zinc-500 hover:text-zinc-300 transition"
          >
            Skip tour
          </button>
        </div>

        {/* Slide content */}
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 via-sky-500 to-emerald-400 text-2xl shadow-[0_8px_24px_rgba(15,23,42,0.5)]">
            {current.emoji}
          </div>
          <div className="flex-1">
            <p className="font-semibold text-zinc-100">{current.title}</p>
            <p className="mt-0.5 text-sm text-zinc-400">{current.body}</p>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-4 flex items-center justify-between gap-3">
          <Link
            href={current.href}
            onClick={dismiss}
            className="text-xs text-indigo-400/80 underline underline-offset-2 hover:text-indigo-300 transition"
          >
            {current.cta}
          </Link>
          <button
            type="button"
            onClick={next}
            className="rounded-full bg-gradient-to-r from-indigo-500 to-sky-400 px-5 py-2 text-sm font-medium text-black shadow transition hover:brightness-110"
          >
            {slide < SLIDES.length - 1 ? "Next →" : "Done"}
          </button>
        </div>
      </div>
    </div>
  );
}
