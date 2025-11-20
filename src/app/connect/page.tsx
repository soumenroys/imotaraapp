/* src/app/connect/page.tsx */
import Link from "next/link";

export const metadata = {
  title: "Connect — Imotara",
  description:
    "Ways to reach the Imotara team for feedback, partnerships, or support.",
};

const FORMSPREE_ID = process.env.NEXT_PUBLIC_FORMSPREE_ID;
const formAction = FORMSPREE_ID
  ? `https://formspree.io/f/${FORMSPREE_ID}`
  : "mailto:support@imotara.com";

export default function ConnectPage() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-16 text-zinc-50 sm:px-6">
      {/* Header */}
      <header className="mb-10 max-w-3xl">
        <div className="imotara-glass-card px-6 py-6 sm:px-8 sm:py-8">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-400">
            Imotara · Connect
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-50 sm:text-4xl">
            Connect with the Imotara team
          </h1>
          <p className="mt-4 leading-7 text-zinc-300">
            We’d love to hear from you — whether you’re sharing feedback,
            exploring partnerships, or need help. Choose a quick contact option
            or drop us a message using the form.
          </p>
        </div>
      </header>

      <div className="mt-6 grid gap-8 lg:grid-cols-2">
        {/* Quick contact cards */}
        <section className="space-y-4">
          <div className="imotara-glass-soft rounded-2xl p-6">
            <h2 className="text-lg font-medium text-zinc-50">Email</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-300">
              The best way to reach us for support, feedback, or press.
            </p>
            <div className="mt-4">
              <a
                href="mailto:support@imotara.com"
                className="inline-flex items-center rounded-full border border-white/20 bg-white/5 px-4 py-2 text-sm text-zinc-100 shadow-sm transition hover:bg-white/10"
              >
                support@imotara.com
              </a>
            </div>
          </div>

          <div className="imotara-glass-soft rounded-2xl p-6">
            <h2 className="text-lg font-medium text-zinc-50">Social</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-300">
              Follow updates, announcements, and behind-the-scenes notes.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <a
                href="https://x.com/imotara"
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full border border-white/20 bg-white/5 px-3 py-1.5 text-sm text-zinc-100 shadow-sm transition hover:bg-white/10"
              >
                X (Twitter)
              </a>
              <a
                href="https://www.linkedin.com/company/imotara"
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full border border-white/20 bg-white/5 px-3 py-1.5 text-sm text-zinc-100 shadow-sm transition hover:bg-white/10"
              >
                LinkedIn
              </a>
              <a
                href="https://github.com/imotara"
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full border border-white/20 bg-white/5 px-3 py-1.5 text-sm text-zinc-100 shadow-sm transition hover:bg-white/10"
              >
                GitHub
              </a>
            </div>
          </div>

          <div className="imotara-glass-soft rounded-2xl p-6">
            <h2 className="text-lg font-medium text-zinc-50">Partnerships</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-300">
              Research collaborations, well-being programs, or platform
              integrations.
            </p>
            <div className="mt-4">
              <a
                href="mailto:partnerships@imotara.com?subject=Partnership%20Inquiry"
                className="inline-flex items-center rounded-full border border-white/20 bg-white/5 px-4 py-2 text-sm text-zinc-100 shadow-sm transition hover:bg-white/10"
              >
                partnerships@imotara.com
              </a>
            </div>
          </div>
        </section>

        {/* Contact form */}
        <section className="imotara-glass-card rounded-2xl p-6 sm:p-7">
          <h2 className="text-lg font-medium text-zinc-50">Send a message</h2>

          {!FORMSPREE_ID && (
            <p className="mt-3 text-sm text-amber-300">
              Tip: Set{" "}
              <code className="rounded bg-black/40 px-1.5 py-0.5 text-xs">
                NEXT_PUBLIC_FORMSPREE_ID
              </code>{" "}
              in your environment to enable the contact form. Until then, it
              will open your mail client.
            </p>
          )}

          <form
            action={formAction}
            method={FORMSPREE_ID ? "POST" : "GET"}
            className="mt-6 space-y-5"
          >
            {/* Honeypot (anti-bot) */}
            <input
              type="text"
              name="_gotcha"
              tabIndex={-1}
              autoComplete="off"
              className="hidden"
              aria-hidden="true"
            />
            {/* Optional redirect after submit (Formspree) */}
            {FORMSPREE_ID && (
              <input
                type="hidden"
                name="_subject"
                value="New message from imotara.com"
              />
            )}

            <div className="grid gap-5 sm:grid-cols-2">
              <div className="flex flex-col">
                <label htmlFor="name" className="text-sm font-medium text-zinc-100">
                  Name
                </label>
                <input
                  id="name"
                  name="name"
                  required
                  className="mt-2 rounded-lg border border-white/20 bg-black/40 px-3 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-500 focus:border-indigo-400/70 focus:ring-2 focus:ring-indigo-500/60"
                  placeholder="Your name"
                />
              </div>

              <div className="flex flex-col">
                <label htmlFor="email" className="text-sm font-medium text-zinc-100">
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  className="mt-2 rounded-lg border border-white/20 bg-black/40 px-3 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-500 focus:border-indigo-400/70 focus:ring-2 focus:ring-indigo-500/60"
                  placeholder="you@example.com"
                />
              </div>
            </div>

            <div className="flex flex-col">
              <label htmlFor="topic" className="text-sm font-medium text-zinc-100">
                Topic
              </label>
              <select
                id="topic"
                name="topic"
                className="mt-2 w-full rounded-lg border border-white/20 bg-black/40 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-indigo-400/70 focus:ring-2 focus:ring-indigo-500/60"
                defaultValue="General"
              >
                <option>General</option>
                <option>Feedback</option>
                <option>Support</option>
                <option>Partnerships</option>
                <option>Press</option>
              </select>
            </div>

            <div className="flex flex-col">
              <label htmlFor="message" className="text-sm font-medium text-zinc-100">
                Message
              </label>
              <textarea
                id="message"
                name="message"
                rows={5}
                required
                className="mt-2 rounded-lg border border-white/20 bg-black/40 px-3 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-500 focus:border-indigo-400/70 focus:ring-2 focus:ring-indigo-500/60"
                placeholder="How can we help?"
              />
            </div>

            <div className="flex items-start gap-3">
              <input
                id="consent"
                name="consent"
                type="checkbox"
                required
                className="mt-1 h-4 w-4 rounded border-zinc-500 bg-black text-indigo-400 focus:ring-indigo-500"
              />
              <label
                htmlFor="consent"
                className="text-sm leading-6 text-zinc-300"
              >
                I agree that Imotara may use this information to contact me
                about my request. See our{" "}
                <Link
                  href="/privacy"
                  className="underline decoration-emerald-300/70 underline-offset-4 hover:text-emerald-200"
                >
                  Privacy Policy
                </Link>
                .
              </label>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="submit"
                className="rounded-full bg-gradient-to-r from-indigo-500 via-sky-500 to-emerald-400 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-sky-900/50 transition hover:brightness-110"
              >
                Send message
              </button>
              <p className="text-xs text-zinc-400">
                Response time: typically 1–2 business days.
              </p>
            </div>
          </form>
        </section>
      </div>

      <p className="mt-10 max-w-3xl text-xs text-zinc-400">
        For urgent safety concerns, please contact local emergency services.
        Imotara is a reflective tool and not a substitute for professional care.
      </p>
    </main>
  );
}
