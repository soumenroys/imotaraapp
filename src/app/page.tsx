import Link from "next/link";

export default function Home() {
  return (
    <section className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-5xl items-center px-4 py-16 sm:py-24">
      <div className="w-full space-y-10">
        {/* Hero glass card */}
        <div className="imotara-glass-card px-6 py-8 sm:px-8 sm:py-10">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-400">
            Imotara · Emotional Companion
          </p>

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

          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link
              href="/chat"
              className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-gradient-to-r from-indigo-500 via-sky-500 to-emerald-400 px-6 py-3 text-sm font-medium text-white shadow-lg shadow-sky-900/40 transition hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-indigo-400/70 focus:ring-offset-2 focus:ring-offset-transparent"
              aria-label="Get started chatting with Imotara"
            >
              <span>Get Started</span>
              <span className="text-xs opacity-80">/chat</span>
            </Link>

            <p className="text-xs text-zinc-400">
              Local-first preview · Your words stay in your browser unless you
              choose otherwise.
            </p>
          </div>
        </div>

        {/* Secondary feature strip */}
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="imotara-glass-soft p-4">
            <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">
              Chat
            </h2>
            <p className="mt-2 text-sm text-zinc-300">
              Share anything — Imotara responds with gentle, contextual
              reflections.
            </p>
          </div>

          <div className="imotara-glass-soft p-4">
            <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">
              Emotion History
            </h2>
            <p className="mt-2 text-sm text-zinc-300">
              Watch your emotional patterns over time with a calm, glowing
              timeline.
            </p>
          </div>

          <div className="imotara-glass-soft p-4">
            <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">
              Consent First
            </h2>
            <p className="mt-2 text-sm text-zinc-300">
              Switch between on-device and remote analysis with a single toggle.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
