import type { Metadata } from "next";
import Link from "next/link";

const SITE_URL = "https://www.imotara.com";

export const metadata: Metadata = {
  title: "Private Mood Tracker App — Talk About Your Feelings — Imotara",
  description:
    "Imotara is a free private mood tracker app that lets you talk about your feelings, see emotional trends over time, and gain self-awareness — with no ads and full privacy.",
  keywords: [
    "private app to talk about your feelings",
    "mood tracker app",
    "private mood journal",
    "talk about feelings app",
    "emotion tracker app",
    "private emotional diary app",
    "mood tracking with AI",
    "free mood tracker",
    "daily mood log app",
    "emotional wellness app",
  ],
  alternates: { canonical: `${SITE_URL}/mood-tracker-app` },
  openGraph: {
    type: "website",
    url: `${SITE_URL}/mood-tracker-app`,
    siteName: "Imotara",
    title: "Private Mood Tracker App — Talk About Your Feelings — Imotara",
    description:
      "Track your mood privately, talk about your feelings, and understand your emotional patterns over time. Free, no ads, no account needed.",
    images: [{ url: `${SITE_URL}/og-image.png`, width: 1200, height: 630, alt: "Imotara Mood Tracker" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Private Mood Tracker App — Talk About Your Feelings — Imotara",
    description: "Free, private mood tracking with AI-powered reflections. No ads, no account needed.",
    images: [`${SITE_URL}/og-image.png`],
  },
};

const faqs = [
  {
    q: "What is a private mood tracker app?",
    a: "A private mood tracker app lets you log how you feel each day without sharing that data with advertisers or third parties. Imotara stores all your entries on your device by default — your feelings stay yours.",
  },
  {
    q: "How does Imotara help me talk about my feelings?",
    a: "Imotara gives you a quiet chat space to write or speak what you're feeling. It responds with gentle AI reflections and over time builds a timeline of your emotional patterns so you can see how your mood shifts.",
  },
  {
    q: "Is Imotara's mood tracker free?",
    a: "Yes. The mood tracker, conversation history, timeline, and AI reflections are all free. No subscription required.",
  },
  {
    q: "Does Imotara share my mood data?",
    a: "No. By default all data is stored locally on your device. Optional cloud sync is available but requires your explicit consent and can be turned off at any time.",
  },
  {
    q: "What does the mood timeline show?",
    a: "The mood timeline in Imotara shows your emotional entries grouped by day and week, with trend summaries and visual indicators that help you spot recurring patterns — like stress every Monday or low mood on specific days.",
  },
  {
    q: "Can I use Imotara as a daily mood journal?",
    a: "Yes. Many users use Imotara as a daily emotional journal — writing a quick note each morning or evening about how they feel. The AI responds thoughtfully and the history is always accessible.",
  },
];

export default function MoodTrackerAppPage() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10 text-zinc-100 sm:px-6" aria-labelledby="page-title">
      <div className="space-y-8">

        {/* Hero */}
        <section className="imotara-glass-card rounded-2xl px-6 py-8 sm:px-8 sm:py-10">
          <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-zinc-400">
            Imotara · Mood Tracker
          </p>
          <h1 id="page-title" className="mt-3 text-3xl font-semibold tracking-tight text-zinc-50 sm:text-4xl">
            A Private App to{" "}
            <span className="bg-gradient-to-r from-indigo-300 via-sky-300 to-emerald-200 bg-clip-text text-transparent">
              Talk About Your Feelings
            </span>
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-zinc-300">
            Imotara is a free mood tracker and emotional companion — a private space to write how you feel,
            receive gentle AI reflections, and watch your emotional patterns unfold over time. No ads, no account
            required, no data sharing.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/chat"
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-indigo-500 via-sky-500 to-emerald-400 px-6 py-3 text-sm font-medium text-white shadow-lg transition hover:brightness-110"
            >
              Start tracking →
            </Link>
            <Link
              href="/history"
              className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-6 py-3 text-sm font-medium text-zinc-200 transition hover:bg-white/10"
            >
              View mood history
            </Link>
          </div>
        </section>

        {/* Features */}
        <section className="grid gap-4 sm:grid-cols-2">
          {[
            {
              title: "Talk about your feelings",
              desc: "Write or speak anything — joy, anxiety, confusion, sadness. Imotara listens and responds with empathy, helping you put words to emotions you might not fully understand yet.",
              color: "text-sky-300",
            },
            {
              title: "Mood timeline",
              desc: "Your emotional history is displayed as a calm timeline grouped by day and week. Spot recurring patterns and see how your mood shifts — without any pressure to improve.",
              color: "text-emerald-300",
            },
            {
              title: "Truly private by default",
              desc: "All entries are stored locally on your device. There is no profile, no public feed, and no algorithms analysing your mood to sell you things.",
              color: "text-indigo-300",
            },
            {
              title: "22 languages",
              desc: "Track your mood and talk about your feelings in English, Hindi, Bengali, Tamil, Spanish, French, Arabic, Japanese, and 14 more languages.",
              color: "text-violet-300",
            },
            {
              title: "AI-powered reflections",
              desc: "Imotara uses GPT-4.1 to provide thoughtful, contextual responses — not scripted replies. It notices what you write and responds to you, not to a template.",
              color: "text-amber-300",
            },
            {
              title: "Works offline",
              desc: "The web app installs as a PWA and both Android and iOS apps support full offline use. Your mood log is always available, even without internet.",
              color: "text-rose-300",
            },
          ].map(({ title, desc, color }) => (
            <div key={title} className="imotara-glass-soft rounded-2xl p-5">
              <h2 className={`text-sm font-semibold ${color}`}>{title}</h2>
              <p className="mt-2 text-sm leading-6 text-zinc-300">{desc}</p>
            </div>
          ))}
        </section>

        {/* How it works */}
        <section className="imotara-glass-soft rounded-2xl px-6 py-6 sm:px-8">
          <h2 className="text-lg font-semibold text-zinc-100">How to track your mood with Imotara</h2>
          <ol className="mt-4 space-y-3 text-sm text-zinc-300">
            {[
              ["Open Imotara", "Go to the chat — no account, no sign-up. Just open and write."],
              ["Write how you feel", "A sentence is enough. 'I feel anxious today.' 'I'm really happy about something.' Even short notes build your history."],
              ["Get a gentle reflection", "Imotara responds with a thoughtful message that acknowledges what you shared without judgment."],
              ["Review your history", "Visit the History tab to see your mood timeline, trends, and patterns across days and weeks."],
            ].map(([step, desc], i) => (
              <li key={step as string} className="flex gap-3">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/10 text-[11px] font-bold text-zinc-300">
                  {i + 1}
                </span>
                <span><strong className="text-zinc-200">{step}.</strong> {desc}</span>
              </li>
            ))}
          </ol>
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

        {/* Download */}
        <section className="imotara-glass-soft rounded-2xl px-6 py-6 sm:px-8">
          <h2 className="text-lg font-semibold text-zinc-100">Available on all platforms</h2>
          <p className="mt-2 text-sm text-zinc-400">Use Imotara in your browser, or download the app for Android or iOS.</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link href="/chat" className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-zinc-200 transition hover:bg-white/10">
              Web app →
            </Link>
            <a href="https://play.google.com/store/apps/details?id=com.imotara.imotara" target="_blank" rel="noopener noreferrer" className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-zinc-200 transition hover:bg-white/10">
              Google Play →
            </a>
            <a href="https://apps.apple.com/in/app/imotara/id6756697569" target="_blank" rel="noopener noreferrer" className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-zinc-200 transition hover:bg-white/10">
              App Store →
            </a>
          </div>
        </section>

      </div>
    </main>
  );
}
