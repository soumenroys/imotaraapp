// src/app/careers/page.tsx
import type { Metadata } from "next";

const SITE_URL = "https://www.imotara.com";

export const metadata: Metadata = {
  title: "Careers — Imotara",
  description:
    "Join Imotara and help tell the story of a kinder, calmer digital world. We're looking for a Digital Content Creator who leads with empathy and tells stories that matter.",
  alternates: { canonical: `${SITE_URL}/careers` },
  openGraph: {
    type: "website",
    url: `${SITE_URL}/careers`,
    siteName: "Imotara",
    title: "Join Imotara — We're Hiring a Digital Content Creator",
    description:
      "Help us tell the story of a kinder, calmer digital world. We're looking for a storyteller who leads with empathy.",
    images: [{ url: `${SITE_URL}/og-image.png`, width: 1200, height: 630, alt: "Imotara Careers" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Join Imotara — We're Hiring a Digital Content Creator",
    description:
      "Help us tell the story of a kinder, calmer digital world. We're looking for a storyteller who leads with empathy.",
    images: [`${SITE_URL}/og-image.png`],
  },
};

// ─── Decorative emotion orbs ──────────────────────────────────────────────────

function HeroIllustration() {
  return (
    <div
      aria-hidden
      className="relative mx-auto mb-6 flex h-28 w-28 items-center justify-center"
    >
      {/* Outer ring */}
      <div className="absolute inset-0 rounded-full border border-indigo-500/20 bg-gradient-to-br from-indigo-600/10 to-violet-600/10 backdrop-blur-md shadow-[0_0_48px_rgba(99,102,241,0.18)]" />
      {/* Middle ring */}
      <div className="absolute inset-4 rounded-full border border-violet-400/15 bg-gradient-to-br from-indigo-500/10 to-fuchsia-500/10" />
      {/* Center glyph */}
      <span className="relative text-4xl select-none">✍️</span>
      {/* Orbiting dots */}
      <span
        className="absolute -top-1 right-4 h-2 w-2 rounded-full bg-indigo-400/60"
        style={{ filter: "blur(1px)" }}
      />
      <span
        className="absolute bottom-2 -left-1 h-1.5 w-1.5 rounded-full bg-violet-400/50"
        style={{ filter: "blur(0.5px)" }}
      />
      <span
        className="absolute bottom-0 right-2 h-1 w-1 rounded-full bg-fuchsia-400/50"
      />
    </div>
  );
}

// ─── Role card ────────────────────────────────────────────────────────────────

function RoleTag({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-indigo-500/20 bg-indigo-500/8 px-3 py-0.5 text-[11px] font-medium text-indigo-300">
      {children}
    </span>
  );
}

// ─── Section ──────────────────────────────────────────────────────────────────

function Section({
  label,
  title,
  children,
  soft = false,
}: {
  label?: string;
  title: string;
  children: React.ReactNode;
  soft?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl px-4 py-5 shadow-md backdrop-blur-md sm:px-6 sm:py-6 ${
        soft ? "imotara-glass-soft" : "imotara-glass-card shadow-xl"
      }`}
    >
      {label && (
        <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-zinc-400">
          {label}
        </p>
      )}
      <h2
        className={`font-semibold tracking-tight text-zinc-50 ${
          label ? "mt-2 text-base sm:text-lg" : "text-sm sm:text-base"
        }`}
      >
        {title}
      </h2>
      <div className="mt-3 text-xs leading-6 text-zinc-300 sm:text-sm">
        {children}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CareersPage() {
  return (
    <main
      className="mx-auto w-full max-w-5xl px-4 py-10 text-zinc-100 sm:px-6"
      aria-labelledby="careers-title"
    >
      <div className="space-y-6 text-sm">

        {/* ── Hero ─────────────────────────────────────────────────────── */}
        <section className="imotara-glass-card rounded-2xl px-4 py-8 shadow-xl backdrop-blur-md sm:px-6 sm:py-10 text-center">
          <HeroIllustration />

          <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-zinc-400">
            Imotara · Careers
          </p>

          <h1
            id="careers-title"
            className="mt-2 text-xl font-semibold tracking-tight text-zinc-50 sm:text-3xl"
          >
            Help us tell stories that heal.
          </h1>

          <p className="mx-auto mt-4 max-w-xl leading-6 text-zinc-300 sm:text-base">
            Imotara was born from the quiet worry of two mothers who wanted the
            world to feel a little kinder. We're growing — and we're looking for
            a voice that carries that same warmth into every word we publish.
          </p>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            <RoleTag>Full-time</RoleTag>
            <RoleTag>Remote · Kolkata preferred</RoleTag>
            <RoleTag>₹8,000 – ₹10,000 / month</RoleTag>
            <RoleTag>Content & Creative</RoleTag>
          </div>
        </section>

        {/* ── Why this role matters ─────────────────────────────────── */}
        <Section label="The Role" title="Digital Content Creator" soft={false}>
          <p>
            Content at Imotara isn't marketing — it's an act of care. Every
            article we publish, every caption we write, every video we release
            is a quiet signal to someone navigating a hard day: <em>you're not
            alone, and this space is safe</em>.
          </p>
          <p className="mt-3">
            We need a storyteller — someone whose first instinct is empathy,
            whose second is craft, and whose third is knowing exactly where that
            story needs to live online. Someone who can turn a complex feeling
            into a sentence that lands softly, and a brand value into content
            that moves people without manipulating them.
          </p>
          <p className="mt-3">
            If that sounds like you, we'd love to hear from you.
          </p>
        </Section>

        {/* ── Responsibilities ──────────────────────────────────────── */}
        <Section label="What you'll do" title="Your Work Here" soft>
          <ul className="list-none space-y-3 pl-0">
            {[
              {
                icon: "📱",
                text: "Write and schedule content across Instagram, LinkedIn, X, and any platform where our community gathers — posts that feel human, not corporate.",
              },
              {
                icon: "✍️",
                text: "Craft blog articles and long-form pieces on emotional wellness, mental clarity, and mindful living — stories that readers save and share.",
              },
              {
                icon: "🎬",
                text: "Produce short-form videos and reels: scripting, on-camera presence or voiceover, light editing — content that earns attention without demanding it.",
              },
              {
                icon: "📬",
                text: "Write email newsletters and nurture sequences that feel like a letter from a friend, not a broadcast from a brand.",
              },
              {
                icon: "🌐",
                text: "Keep our website copy fresh and honest — landing pages, feature descriptions, and onboarding text that welcome users with clarity and warmth.",
              },
              {
                icon: "💬",
                text: "Turn real user experiences into case studies and testimonial narratives that show what emotional safety looks like in practice.",
              },
              {
                icon: "🌱",
                text: "Be the keeper of Imotara's voice — ensuring every word we publish stays true to our values: calm, private, kind, and real.",
              },
              {
                icon: "🎨",
                text: "Work closely with our design direction: communicate creative briefs, suggest visual ideas, and help make our aesthetic match our tone.",
              },
              {
                icon: "📊",
                text: "Track what's working — use analytics to understand how content is landing, and adjust thoughtfully without chasing shallow metrics.",
              },
              {
                icon: "🤝",
                text: "Help nurture our community: respond to comments and messages with the same care we'd want users to feel inside the app itself.",
              },
            ].map(({ icon, text }) => (
              <li key={icon} className="flex items-start gap-3">
                <span className="mt-0.5 flex-shrink-0 text-base">{icon}</span>
                <span className="leading-6 text-zinc-300">{text}</span>
              </li>
            ))}
          </ul>
        </Section>

        {/* ── What we're looking for ────────────────────────────────── */}
        <div className="grid gap-4 md:grid-cols-2">
          <Section label="You bring" title="Who You Are" soft>
            <ul className="list-disc space-y-2 pl-5">
              <li>5+ years writing content that has actually moved people — across social media, blogs, email, and video.</li>
              <li>A natural empathy that shows up in your writing. You understand that feelings are complicated, and you never flatten them into slogans.</li>
              <li>Comfort with the camera or a microphone — you can script and present, not just write.</li>
              <li>SEO literacy — you know how to write for both search engines and human beings, in that order.</li>
              <li>Experience with content calendars, scheduling tools, and analytics dashboards.</li>
              <li>A storytelling instinct: you find the human thread in everything and pull it through.</li>
            </ul>
          </Section>

          <Section label="Bonus" title="You'll Shine If..." soft>
            <ul className="list-disc space-y-2 pl-5">
              <li>You have a background, training, or deep personal familiarity with mental health, emotional wellness, or mindfulness.</li>
              <li>You've built or grown an audience — a blog, channel, newsletter, or social account — driven by authentic storytelling.</li>
              <li>You know Canva, CapCut, Premiere, or any creative tool well enough to move fast without waiting for a designer.</li>
              <li>You speak another language fluently — Imotara serves users across cultures, and that sensitivity matters here.</li>
              <li>You care about privacy and technology ethics. You'll be speaking for a product built around those values.</li>
            </ul>
          </Section>
        </div>

        {/* ── What we offer ─────────────────────────────────────────── */}
        <Section label="What we offer" title="Life at Imotara" soft={false}>
          <div className="grid gap-5 sm:grid-cols-3">
            {[
              {
                icon: "🌍",
                heading: "Work from anywhere",
                body: "Fully remote, with a preference for Kolkata-based collaboration when we need to work in person. Your space, your rhythm.",
              },
              {
                icon: "🌿",
                heading: "Meaningful work, every day",
                body: "The words you write will help real people feel less alone. That's not a mission statement — that's what we ship.",
              },
              {
                icon: "📈",
                heading: "Room to grow",
                body: "We're an early team. The person who joins now will shape how Imotara speaks to the world for years to come.",
              },
            ].map(({ icon, heading, body }) => (
              <div key={heading} className="space-y-1.5">
                <p className="text-lg">{icon}</p>
                <p className="font-medium text-zinc-100">{heading}</p>
                <p className="leading-6 text-zinc-400">{body}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* ── Apply ─────────────────────────────────────────────────── */}
        <section className="imotara-glass-card rounded-2xl px-4 py-8 text-center shadow-xl backdrop-blur-md sm:px-6 sm:py-10">
          <p className="text-2xl select-none" aria-hidden>🌸</p>

          <h2 className="mt-3 text-base font-semibold tracking-tight text-zinc-50 sm:text-lg">
            Ready to write for a calmer world?
          </h2>

          <p className="mx-auto mt-3 max-w-md leading-6 text-zinc-400">
            Send us your story — a short note about why this role feels right for you,
            a recent photo, and your CV or portfolio.
          </p>

          <p className="mx-auto mt-2 max-w-md leading-6 text-zinc-500 text-xs">
            No cover letter template needed. Just be honest about who you are and what
            you care about. That's what we're hiring for.
          </p>

          <a
            href="mailto:publisher@imotara.com?subject=Digital Content Creator — Application"
            className="mt-6 inline-flex items-center gap-2.5 rounded-full bg-indigo-600 px-7 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-900/30 transition hover:bg-indigo-500 hover:shadow-indigo-800/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900"
          >
            <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 flex-shrink-0" aria-hidden>
              <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.6" />
              <path d="m3 7 9 6 9-6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
            Apply — publisher@imotara.com
          </a>

          <p className="mt-4 text-[11px] text-zinc-600">
            Attach your photo and CV to the email. We read every application personally.
          </p>
        </section>

        {/* ── Closing note ─────────────────────────────────────────── */}
        <p className="text-center text-xs leading-6 text-zinc-600 pb-2">
          Imotara does not discriminate on the basis of gender, background, or belief.
          We believe the best stories come from the widest range of human experience.
        </p>

      </div>
    </main>
  );
}
