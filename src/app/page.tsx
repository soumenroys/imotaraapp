import Link from "next/link";

export default function Home() {
  return (
    <section className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-5xl items-center px-4 py-16 sm:py-24">
      <div className="w-full space-y-10">
        {/* Hero glass card */}
        <div className="imotara-glass-card px-6 py-8 sm:px-8 sm:py-10">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.25em] text-zinc-400">
            <span>Imotara · Emotional Companion</span>
            <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-200 ring-1 ring-emerald-400/40">
              Web beta
            </span>
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
              Local-first preview. Your words are stored in this browser. Remote
              analysis happens only if you explicitly allow it in settings.
            </p>
          </div>
        </div>

        {/* Secondary feature strip */}
        <div className="grid gap-4 sm:grid-cols-3">
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
        </div>
      </div>
    </section>
  );
}
