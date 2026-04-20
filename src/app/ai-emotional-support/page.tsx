import type { Metadata } from "next";
import Link from "next/link";

const SITE_URL = "https://www.imotara.com";

export const metadata: Metadata = {
  title: "AI Companion for Emotional Support — Imotara",
  description:
    "Imotara is a free AI companion for emotional support. Talk about your feelings anytime, get gentle reflections, and track your mood — privately, in 22 languages, with no ads.",
  keywords: [
    "AI companion for emotional support",
    "AI emotional support app",
    "AI friend for mental health",
    "talk to AI about feelings",
    "AI chat for emotional support",
    "free AI companion app",
    "private AI emotional wellness",
    "AI support for anxiety",
    "AI mental health companion",
    "emotional support chatbot",
  ],
  alternates: { canonical: `${SITE_URL}/ai-emotional-support` },
  openGraph: {
    type: "website",
    url: `${SITE_URL}/ai-emotional-support`,
    siteName: "Imotara",
    title: "AI Companion for Emotional Support — Imotara",
    description:
      "Talk about your feelings with Imotara — a free, private AI companion that listens without judgment, tracks your mood, and supports your emotional wellness.",
    images: [{ url: `${SITE_URL}/og-image.png`, width: 1200, height: 630, alt: "Imotara AI Emotional Support" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "AI Companion for Emotional Support — Imotara",
    description: "A free, private AI companion that listens, reflects, and supports your emotional wellness.",
    images: [`${SITE_URL}/og-image.png`],
  },
};

const faqs = [
  {
    q: "What is an AI companion for emotional support?",
    a: "An AI emotional support companion is a private, always-available space where you can talk about how you feel — without judgment. Imotara listens, reflects your thoughts back gently, and helps you notice emotional patterns over time.",
  },
  {
    q: "How is Imotara different from a chatbot?",
    a: "Unlike generic chatbots, Imotara is purpose-built for emotional wellness. It remembers your conversations, surfaces mood patterns over time, and responds with empathy — not just information. It's more like a quiet friend than a search engine.",
  },
  {
    q: "Is Imotara free?",
    a: "Yes. Imotara is completely free to use with no paywalls or required subscriptions.",
  },
  {
    q: "Is my emotional data private?",
    a: "Yes. All conversations are stored on your device by default. Cloud sync is optional and requires your explicit consent. No ads, no data selling.",
  },
  {
    q: "Can I use Imotara when I feel anxious or overwhelmed?",
    a: "Yes. Many users find it helpful to open Imotara when they feel anxious, stressed, or overwhelmed — to write out what they're feeling and receive a gentle, non-judgmental reflection.",
  },
  {
    q: "Is Imotara a replacement for therapy?",
    a: "No. Imotara is a wellness companion for self-reflection — not a medical or therapeutic service. It complements, but does not replace, professional mental health care.",
  },
];

export default function AiEmotionalSupportPage() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10 text-zinc-100 sm:px-6" aria-labelledby="page-title">
      <div className="space-y-8">

        {/* Hero */}
        <section className="imotara-glass-card rounded-2xl px-6 py-8 sm:px-8 sm:py-10">
          <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-zinc-400">
            Imotara · AI Emotional Support
          </p>
          <h1 id="page-title" className="mt-3 text-3xl font-semibold tracking-tight text-zinc-50 sm:text-4xl">
            An AI Companion for{" "}
            <span className="bg-gradient-to-r from-indigo-300 via-sky-300 to-emerald-200 bg-clip-text text-transparent">
              Emotional Support
            </span>
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-zinc-300">
            Imotara is a free, private AI companion that listens to how you feel — without judgment, without ads,
            and without sharing your data. Talk about anything on your mind and receive gentle, thoughtful reflections
            in your language, at your pace.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/chat"
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-indigo-500 via-sky-500 to-emerald-400 px-6 py-3 text-sm font-medium text-white shadow-lg transition hover:brightness-110"
            >
              Start talking →
            </Link>
            <a
              href="https://play.google.com/store/apps/details?id=com.imotara.imotara"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-6 py-3 text-sm font-medium text-zinc-200 transition hover:bg-white/10"
            >
              Get on Android
            </a>
            <a
              href="https://apps.apple.com/in/app/imotara/id6756697569"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-6 py-3 text-sm font-medium text-zinc-200 transition hover:bg-white/10"
            >
              Get on iOS
            </a>
          </div>
        </section>

        {/* What it does */}
        <section className="imotara-glass-soft rounded-2xl px-6 py-6 sm:px-8">
          <h2 className="text-lg font-semibold text-zinc-100">How Imotara supports you emotionally</h2>
          <ul className="mt-4 space-y-3 text-sm text-zinc-300">
            {[
              ["Listen without judgment", "Type or speak what you're feeling. Imotara responds with empathy, not advice you didn't ask for."],
              ["Reflect your patterns", "Over time, Imotara surfaces emotional trends — so you can see how your feelings shift across days and weeks."],
              ["Available anytime", "No appointments, no waiting rooms. Open Imotara whenever you need a quiet space — day or night."],
              ["22 languages supported", "Imotara understands and responds in English, Hindi, Bengali, Tamil, Spanish, French, Arabic, Japanese, and 14 more languages."],
              ["Local-first privacy", "Your words stay on your device by default. Cloud sync is optional and requires your consent."],
              ["Free, no ads", "Imotara is completely free. No ads, no subscription required, no data selling."],
            ].map(([title, desc]) => (
              <li key={title as string} className="flex gap-3">
                <span className="mt-0.5 text-sky-400">✦</span>
                <span><strong className="text-zinc-200">{title}.</strong> {desc}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Who it's for */}
        <section className="imotara-glass-soft rounded-2xl px-6 py-6 sm:px-8">
          <h2 className="text-lg font-semibold text-zinc-100">Who uses Imotara for emotional support?</h2>
          <p className="mt-3 text-sm leading-6 text-zinc-300">
            Imotara is used by people who want a private, low-pressure space to process their emotions — without
            the social performance of public platforms or the cost and scheduling of professional services.
          </p>
          <ul className="mt-4 space-y-2 text-sm text-zinc-400">
            {[
              "People dealing with day-to-day stress, anxiety, or overwhelm",
              "Those who find it easier to write feelings than speak them aloud",
              "People who want to understand their emotional patterns over time",
              "Anyone who wants an AI companion that feels personal, not generic",
              "Users in 22 languages who want emotional support in their native tongue",
            ].map((item) => (
              <li key={item} className="flex gap-2"><span className="text-indigo-400">→</span>{item}</li>
            ))}
          </ul>
        </section>

        {/* FAQ */}
        <section className="imotara-glass-soft rounded-2xl px-6 py-6 sm:px-8">
          <h2 className="text-lg font-semibold text-zinc-100">Frequently asked questions</h2>
          <dl className="mt-4 space-y-5">
            {faqs.map(({ q, a }) => (
              <div key={q}>
                <dt className="text-sm font-medium text-zinc-200">{q}</dt>
                <dd className="mt-1 text-sm leading-6 text-zinc-400">{a}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* CTA */}
        <section className="rounded-2xl border border-indigo-400/20 bg-indigo-500/8 px-6 py-6 text-center sm:px-8">
          <p className="text-base font-medium text-zinc-100">Ready to talk?</p>
          <p className="mt-1 text-sm text-zinc-400">Free, private, no account needed.</p>
          <Link
            href="/chat"
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-indigo-500 via-sky-500 to-emerald-400 px-8 py-3 text-sm font-medium text-white shadow-lg transition hover:brightness-110"
          >
            Open Imotara →
          </Link>
        </section>

      </div>
    </main>
  );
}
