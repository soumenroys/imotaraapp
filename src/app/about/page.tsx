// src/app/about/page.tsx

export const metadata = {
  title: "About — Imotara",
  description:
    "What Imotara is, why it exists, and the principles behind an emotion-aware, privacy-first companion.",
};

export default function AboutPage() {
  return (
    <main
      className="mx-auto w-full max-w-5xl px-4 py-10 text-zinc-100 sm:px-6"
      aria-labelledby="about-title"
    >
      <div className="space-y-6 text-sm">

        {/* Hero / Intro */}
        <section className="imotara-glass-card rounded-2xl px-4 py-5 shadow-xl backdrop-blur-md sm:px-6 sm:py-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-zinc-400">
            Imotara · About
          </p>

          <h1
            id="about-title"
            className="mt-2 text-xl font-semibold tracking-tight text-zinc-50 sm:text-2xl"
          >
            About Imotara
          </h1>

          <p className="mt-3 leading-6 text-zinc-300 sm:text-base">
            Imotara is a gentle, emotion-aware companion — designed to listen
            quietly, reflect softly, and grow with your inner world over time.
            There are no ads, no engagement tricks, and no hidden agendas.
            Just presence, memory, and care. Your data stays yours — always.
          </p>
        </section>

        {/* Divider */}
        <div className="h-[1px] w-full bg-white/5" />

        {/* Principles + Roadmap */}
        <section className="grid gap-4 lg:grid-cols-2">

          {/* Principles */}
          <div className="imotara-glass-soft rounded-2xl px-4 py-4 shadow-md backdrop-blur-md sm:px-5 sm:py-5">
            <h2 className="text-sm font-semibold text-zinc-50 sm:text-base">
              Principles
            </h2>

            <ul className="mt-3 list-disc space-y-2 pl-5 text-xs leading-6 text-zinc-300 sm:text-sm">
              <li>User data sovereignty and consent-first design.</li>
              <li>Calm, humane technology — no noise, no dopamine traps.</li>
              <li>
                Long-term emotional memory with clear, transparent controls
                for you to delete, export, or move anywhere.
              </li>
              <li>
                Local-first architecture: everything stays on your device
                unless you explicitly say otherwise.
              </li>
            </ul>
          </div>

          {/* Roadmap */}
          <div className="imotara-glass-soft rounded-2xl px-4 py-4 shadow-md backdrop-blur-md sm:px-5 sm:py-5">
            <h2 className="text-sm font-semibold text-zinc-50 sm:text-base">
              Roadmap
            </h2>

            <p className="mt-3 text-xs leading-6 text-zinc-300 sm:text-sm">
              <span className="font-medium text-zinc-200">
                Phase 1 — Imotara:
              </span>{" "}
              A quiet, local-first emotional companion with journaling,
              reflection, and pattern awareness. This release is intentionally
              simple, private, and offline-safe.
            </p>

            <p className="mt-3 text-xs leading-6 text-zinc-300 sm:text-sm">
              <span className="font-medium text-zinc-200">
                Phase 2 — Synkora Cloud:
              </span>{" "}
              A user-owned cognitive layer that lets you carry your emotional
              history across devices, with encrypted sync and a personal data
              trust under your control.
            </p>

            <p className="mt-3 text-xs leading-6 text-zinc-300 sm:text-sm">
              Imotara is only the beginning — a foundation for a long-term,
              ethical emotional AI ecosystem.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
