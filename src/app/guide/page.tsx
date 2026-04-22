import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "How to Use Imotara — AI Emotional Wellness Companion",
  description:
    "A step-by-step guide to getting started with Imotara: talk freely, personalize your companion, and keep your data private.",
  openGraph: {
    title: "How to Use Imotara",
    description:
      "Imotara is a quiet, private space for your emotions. Learn how to talk freely, work offline, personalize your companion, and control your data.",
    url: "https://imotara.com/guide",
    siteName: "Imotara",
    type: "website",
  },
  alternates: { canonical: "https://imotara.com/guide" },
};

const STEPS = [
  {
    number: "01",
    color: "text-indigo-400",
    borderColor: "border-indigo-500/30",
    bg: "bg-indigo-500/10",
    icon: "💬",
    title: "Just talk",
    body: "Share what's on your mind — worries, stress, frustration, or simply how your day went. There is no right way to start. Imotara listens without judgment and responds with care.",
  },
  {
    number: "02",
    color: "text-sky-400",
    borderColor: "border-sky-500/30",
    bg: "bg-sky-500/10",
    icon: "☁️",
    title: "Works everywhere",
    body: "When online, Imotara uses AI to craft thoughtful replies. Even without internet, local mode keeps your conversations going — no interruptions, no blank screens.",
  },
  {
    number: "03",
    color: "text-amber-400",
    borderColor: "border-amber-500/30",
    bg: "bg-amber-500/10",
    icon: "🎨",
    title: "Make it yours",
    body: "Choose your companion's name, tone, and relationship style — close friend, calm companion, coach, or mentor. Adjust language and age tone in Settings anytime.",
  },
  {
    number: "04",
    color: "text-emerald-400",
    borderColor: "border-emerald-500/30",
    bg: "bg-emerald-500/10",
    icon: "🔒",
    title: "Your data, your control",
    body: "Everything you share stays on your device unless you choose to sync. Nothing is sold. You can export or delete your history anytime from Settings.",
  },
];

export default function GuidePage() {
  return (
    <main className="mx-auto max-w-2xl px-5 py-16 sm:py-24">
      {/* Header */}
      <div className="mb-12 text-center">
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-indigo-400">
          Getting started
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-zinc-100 sm:text-4xl">
          How to use Imotara
        </h1>
        <p className="mt-4 text-sm leading-7 text-zinc-400 sm:text-base">
          Imotara is a quiet, private space for your emotions.
          <br className="hidden sm:block" />
          Here is everything you need to get started.
        </p>
      </div>

      {/* Steps */}
      <div className="relative space-y-0">
        {STEPS.map((step, i) => (
          <div key={step.number} className="flex gap-5">
            {/* Left column: step badge + connector */}
            <div className="flex flex-col items-center">
              <div
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border text-xl ${step.bg} ${step.borderColor}`}
              >
                {step.icon}
              </div>
              {i < STEPS.length - 1 && (
                <div className="my-1 w-px flex-1 bg-zinc-700/60" />
              )}
            </div>

            {/* Right column: text */}
            <div className={`pb-10 pt-1 ${i === STEPS.length - 1 ? "pb-0" : ""}`}>
              <p className={`mb-0.5 text-xs font-semibold ${step.color}`}>
                Step {step.number}
              </p>
              <h2 className="mb-1.5 text-base font-bold text-zinc-100 sm:text-lg">
                {step.title}
              </h2>
              <p className="text-sm leading-7 text-zinc-400">{step.body}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Footer callout */}
      <div className="mt-10 rounded-xl border border-indigo-500/20 bg-indigo-500/8 px-5 py-4 text-center">
        <p className="text-sm leading-6 text-indigo-300/90">
          You do not have to know what to say.
          <br />
          Just start — Imotara meets you where you are.
        </p>
      </div>

      {/* CTA */}
      <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
        <Link
          href="/chat"
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow hover:bg-indigo-500 transition-colors"
        >
          Start a conversation
        </Link>
        <Link
          href="/settings"
          className="text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          Customize companion →
        </Link>
      </div>
    </main>
  );
}
