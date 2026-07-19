import type { Metadata } from "next";
import Link from "next/link";

const SITE_URL = "https://www.imotara.com";

export const metadata: Metadata = {
  title: "Emotional Wellness App — Free & Private — Imotara",
  description:
    "Imotara is a free private emotional wellness app. Get gentle companion support, track your mood, and build self-awareness — in 22 languages, no ads, fully private.",
  keywords: [
    "emotional wellness app",
    "free mental wellness app",
    "private app for mental health",
    "mental wellness companion",
    "private self-care app",
    "emotional wellness app",
    "mindfulness app",
    "companion for emotional wellbeing",
    "mental health app no subscription",
    "private mental wellness app",
  ],
  alternates: { canonical: `${SITE_URL}/ai-mental-wellness` },
  openGraph: {
    type: "website",
    url: `${SITE_URL}/ai-mental-wellness`,
    siteName: "Imotara",
    title: "Emotional Wellness App — Free & Private — Imotara",
    description:
      "Imotara is a free private mental wellness companion. Talk about your feelings, track your mood, and build emotional self-awareness — privately, in 22 languages.",
    images: [{ url: `${SITE_URL}/og-image.png`, width: 1200, height: 630, alt: "Imotara Mental Wellness" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Emotional Wellness App — Free & Private — Imotara",
    description: "Free private mental wellness companion. No ads, 22 languages, no account needed.",
    images: [`${SITE_URL}/og-image.png`],
  },
};

const faqs = [
  {
    q: "What is Imotara?",
    a: "Imotara is a private companion that supports your emotional health — helping you reflect on feelings, track mood patterns, and build self-awareness. Imotara is designed to be private, empathetic, and judgment-free.",
  },
  {
    q: "How does Imotara support mental wellness?",
    a: "Imotara provides a private space to talk about how you feel, get thoughtful reflections, track your mood over time, and practice mindfulness with built-in breathing exercises. It helps you develop emotional awareness and healthy self-reflection habits.",
  },
  {
    q: "Is Imotara free?",
    a: "Yes. All core features — chat, mood history, timeline, companion reflections, and mindfulness tools — are completely free. No subscription, no paywall.",
  },
  {
    q: "Is Imotara safe and private?",
    a: "Yes. Imotara is local-first by design. Your conversations and mood data are stored on your device. There are no ads, no data selling, and cloud sync is strictly opt-in.",
  },
  {
    q: "What languages does Imotara support?",
    a: "Imotara supports 22 languages: English, Hindi, Bengali, Marathi, Tamil, Telugu, Gujarati, Punjabi, Kannada, Malayalam, Odia, Urdu, Spanish, French, German, Portuguese, Russian, Arabic, Chinese, Japanese, Hebrew, and Indonesian.",
  },
  {
    q: "Can Imotara help with anxiety or stress?",
    a: "Imotara can help you process anxious thoughts, identify stress patterns over time, and practice breathing exercises. However, it is a wellness companion — not a medical device or therapy service. For clinical care, please consult a qualified professional.",
  },
  {
    q: "How is Imotara different from other mental wellness apps?",
    a: "Most mental wellness apps are subscription-based, ad-supported, or require creating an account. Imotara is free, has no ads, works without an account, stores data locally by default, and supports 22 languages — making it accessible to a much wider audience.",
  },
];

export default function AiMentalWellnessPage() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10 text-zinc-100 sm:px-6" aria-labelledby="page-title">
      <div className="space-y-8">

        {/* Hero */}
        <section className="imotara-glass-card rounded-2xl px-6 py-8 sm:px-8 sm:py-10">
          <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-zinc-400">
            Imotara · Mental Wellness
          </p>
          <h1 id="page-title" className="mt-3 text-3xl font-semibold tracking-tight text-zinc-50 sm:text-4xl">
            A Free Private App for{" "}
            <span className="bg-gradient-to-r from-indigo-300 via-sky-300 to-emerald-200 bg-clip-text text-transparent">
              Mental Wellness
            </span>
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-zinc-300">
            Imotara is a free, private companion for your emotional wellbeing. Talk about your feelings,
            track your mood, practice mindfulness, and build emotional self-awareness — in 22 languages,
            with no ads and no account required.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/chat"
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-indigo-500 via-sky-500 to-emerald-400 px-6 py-3 text-sm font-medium text-white shadow-lg transition hover:brightness-110"
            >
              Start for free →
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

        {/* Why it matters */}
        <section className="imotara-glass-soft rounded-2xl px-6 py-6 sm:px-8">
          <h2 className="text-lg font-semibold text-zinc-100">Why mental wellness needs a private AI companion</h2>
          <p className="mt-3 text-sm leading-6 text-zinc-300">
            Most people don't have daily access to a therapist — and not everyone is comfortable journaling alone.
            Imotara fills that gap: a quiet, always-available companion that helps you process emotions, spot patterns,
            and build healthier self-awareness habits. No appointments. No judgment. No cost.
          </p>
        </section>

        {/* Features grid */}
        <section>
          <h2 className="mb-4 text-lg font-semibold text-zinc-100">Mental wellness features</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { title: "Private emotional chat", desc: "Talk about anything — stress, relationships, low mood, gratitude. Get thoughtful, personalised reflections.", color: "from-indigo-500/20 to-sky-500/10" },
              { title: "Mood history & trends", desc: "A visual timeline of your emotional entries. See patterns you might miss in the moment.", color: "from-emerald-500/20 to-teal-500/10" },
              { title: "Mindfulness & breathing", desc: "Built-in breathing exercises to calm anxiety and ground yourself in the present moment.", color: "from-violet-500/20 to-indigo-500/10" },
              { title: "Daily reflection prompts", desc: "Gentle prompts to help you check in with yourself — even on days when words don't come easily.", color: "from-amber-500/20 to-orange-500/10" },
              { title: "22 languages", desc: "Emotional support in your native language. Hindi, Bengali, Tamil, Spanish, Arabic, Japanese, and more.", color: "from-sky-500/20 to-cyan-500/10" },
              { title: "No ads, no surveillance", desc: "No behavioural tracking, no engagement algorithms, no content designed to keep you anxious.", color: "from-rose-500/20 to-pink-500/10" },
            ].map(({ title, desc, color }) => (
              <div key={title} className={`rounded-2xl border border-white/10 bg-gradient-to-br ${color} p-5`}>
                <h3 className="text-sm font-semibold text-zinc-100">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-zinc-400">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Comparison */}
        <section className="imotara-glass-soft rounded-2xl px-6 py-6 sm:px-8">
          <h2 className="text-lg font-semibold text-zinc-100">How Imotara compares</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm text-zinc-300">
              <thead>
                <tr className="border-b border-white/10 text-left text-[11px] font-semibold uppercase tracking-[0.15em] text-zinc-500">
                  <th className="pb-3 pr-4">Feature</th>
                  <th className="pb-3 pr-4 text-indigo-300">Imotara</th>
                  <th className="pb-3 pr-4">Typical wellness apps</th>
                </tr>
              </thead>
              <tbody className="space-y-2">
                {[
                  ["Free", "✓ Fully free", "Often subscription"],
                  ["Private / local-first", "✓ On-device by default", "Cloud-first, ads"],
                  ["No account needed", "✓ No sign-up", "Usually required"],
                  ["Companion reflections", "✓ Private & secure", "Scripted or none"],
                  ["Mood timeline", "✓ Built-in", "Often paywalled"],
                  ["22 languages", "✓ Supported", "Usually English only"],
                  ["Offline use", "✓ Full offline support", "Rarely"],
                ].map(([feat, imotara, others]) => (
                  <tr key={feat as string} className="border-b border-white/5">
                    <td className="py-2.5 pr-4 font-medium text-zinc-300">{feat}</td>
                    <td className="py-2.5 pr-4 text-emerald-300">{imotara}</td>
                    <td className="py-2.5 text-zinc-500">{others}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
          <p className="text-base font-medium text-zinc-100">Start your mental wellness journey today</p>
          <p className="mt-1 text-sm text-zinc-400">Free. Private. No account needed.</p>
          <div className="mt-4 flex flex-wrap justify-center gap-3">
            <Link
              href="/chat"
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-indigo-500 via-sky-500 to-emerald-400 px-8 py-3 text-sm font-medium text-white shadow-lg transition hover:brightness-110"
            >
              Open web app →
            </Link>
            <a href="https://play.google.com/store/apps/details?id=com.imotara.imotara" target="_blank" rel="noopener noreferrer" className="inline-flex items-center rounded-full border border-white/20 bg-white/5 px-6 py-3 text-sm text-zinc-200 transition hover:bg-white/10">
              Android
            </a>
            <a href="https://apps.apple.com/in/app/imotara/id6756697569" target="_blank" rel="noopener noreferrer" className="inline-flex items-center rounded-full border border-white/20 bg-white/5 px-6 py-3 text-sm text-zinc-200 transition hover:bg-white/10">
              iOS
            </a>
          </div>
        </section>

      </div>
    </main>
  );
}
