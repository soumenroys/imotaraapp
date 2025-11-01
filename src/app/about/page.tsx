export const metadata = {
  title: "About — Imotara",
  description:
    "What Imotara is, why it exists, and the principles behind an emotion-aware, privacy-first companion.",
};

export default function AboutPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-16 text-zinc-900 dark:text-zinc-100">
      <h1 className="text-3xl font-semibold tracking-tight">About Imotara</h1>
      <p className="mt-6 leading-7 text-zinc-600 dark:text-zinc-400">
        Imotara is an emotion-aware companion that listens, learns, and grows
        with you — quietly, ethically, and forever. No surveillance. No ads.
        Just presence, reflection, and care.
      </p>

      <section className="mt-10 space-y-4">
        <h2 className="text-xl font-medium">Principles</h2>
        <ul className="list-disc pl-6 text-zinc-600 dark:text-zinc-400">
          <li>User data sovereignty and consent-first design.</li>
          <li>Calm technology—no noise, no dopamine traps.</li>
          <li>Long-term memory with transparent control.</li>
        </ul>
      </section>

      <section className="mt-10 space-y-4">
        <h2 className="text-xl font-medium">Roadmap</h2>
        <p className="text-zinc-600 dark:text-zinc-400">
          Phase 1 (Imotara MVP): a lightweight, privacy-respecting
          journaling+reflection loop. Phase 2 (Synkora Cloud): a scalable,
          user-owned cognitive kernel and data trust layer.
        </p>
      </section>
    </main>
  );
}
