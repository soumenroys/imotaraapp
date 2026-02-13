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

        {/* Principles + Roadmap + History */}
        <section className="space-y-4">

          {/* History */}
          <div className="imotara-glass-soft rounded-2xl px-4 py-4 shadow-md backdrop-blur-md sm:px-5 sm:py-5">
            <h2 className="text-sm font-semibold text-zinc-50 sm:text-base">
              History
            </h2>

            <p className="mt-3 text-xs leading-6 text-zinc-300 sm:text-sm">
              Saswati and Parbati were two caring mothers living ordinary days
              filled with extraordinary effort — packing tiffins, wiping plates,
              folding clothes, counting the month’s expenses twice, and still
              keeping one ear open for the smallest change in their child’s
              voice.
            </p>

            <p className="mt-3 text-xs leading-6 text-zinc-300 sm:text-sm">
              Some evenings, when the house finally became quiet, they would
              notice what no report card could show: a child smiling less, a
              door closing faster, a growing silence that didn’t have words.
              They didn’t want a “perfect” child — they wanted a safe one. And
              they wished there was a gentle space where feelings could be
              spoken without fear, without judgement, without turning into a
              fight.
            </p>

            <p className="mt-3 text-xs leading-6 text-zinc-300 sm:text-sm">
              That is where the idea of Imotara was born — not in a boardroom,
              but in the quiet concern of two mothers who believed that emotions
              deserve kindness. A companion that listens softly, helps someone
              name what they feel, and leaves them with a little more calm than
              before.
            </p>

            <p className="mt-3 text-xs leading-6 text-zinc-300 sm:text-sm">
              For Saswati. For Parbati. For every parent who loves deeply — and
              every child who needs a place to breathe.
            </p>
          </div>

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
              <span className="font-medium text-zinc-200">Imotara today:</span>{" "}
              a calm, local-first companion for journaling, reflection, and
              gentle pattern awareness — designed to stay private, simple, and
              offline-safe by default.
            </p>

            <p className="mt-3 text-xs leading-6 text-zinc-300 sm:text-sm">
              <span className="font-medium text-zinc-200">What’s next:</span>{" "}
              thoughtful improvements that keep the same promise — clarity,
              consent, and control. New features will be added carefully, without
              changing Imotara’s quiet nature or introducing engagement tricks.
            </p>

            <p className="mt-3 text-xs leading-6 text-zinc-300 sm:text-sm">
              Imotara is built for the long run — a steady space you can return
              to, where your data remains yours and your pace is respected.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
