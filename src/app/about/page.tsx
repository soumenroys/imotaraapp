export const metadata = {
  title: "About — Imotara",
  description:
    "What Imotara is, why it exists, and the principles behind an emotion-aware, privacy-first companion.",
};

export default function AboutPage() {
  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-16 text-zinc-50 sm:px-6">
      {/* Hero / Intro */}
      <section className="imotara-glass-card px-6 py-8 sm:px-8 sm:py-10">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-400">
          Imotara · About
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-50 sm:text-4xl">
          About Imotara
        </h1>
        <p className="mt-5 leading-7 text-zinc-300">
          Imotara is an emotion-aware companion that listens, learns, and grows
          with you — quietly, ethically, and forever. No surveillance. No ads.
          Just presence, reflection, and care.
        </p>
      </section>

      {/* Principles + Roadmap row */}
      <section className="mt-8 grid gap-6 lg:grid-cols-2">
        {/* Principles */}
        <div className="imotara-glass-soft rounded-2xl p-6">
          <h2 className="text-xl font-medium text-zinc-50">Principles</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-zinc-300">
            <li>User data sovereignty and consent-first design.</li>
            <li>Calm technology—no noise, no dopamine traps.</li>
            <li>Long-term memory with transparent control.</li>
          </ul>
        </div>

        {/* Roadmap */}
        <div className="imotara-glass-soft rounded-2xl p-6">
          <h2 className="text-xl font-medium text-zinc-50">Roadmap</h2>
          <p className="mt-3 text-sm leading-7 text-zinc-300">
            Phase 1 (Imotara MVP): a lightweight, privacy-respecting
            journaling+reflection loop. Phase 2 (Synkora Cloud): a scalable,
            user-owned cognitive kernel and data trust layer.
          </p>
        </div>
      </section>
    </main>
  );
}
