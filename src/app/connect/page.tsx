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
    <main className="mx-auto w-full max-w-5xl px-6 py-16 text-zinc-900 dark:text-zinc-100">
      <header className="max-w-3xl">
        <h1 className="text-3xl font-semibold tracking-tight">Connect</h1>
        <p className="mt-6 leading-7 text-zinc-600 dark:text-zinc-400">
          We’d love to hear from you — whether you’re sharing feedback, exploring
          partnerships, or need help. Choose a quick contact option or drop us a
          message using the form.
        </p>
      </header>

      <div className="mt-10 grid gap-8 lg:grid-cols-2">
        {/* Quick contact cards */}
        <section className="space-y-4">
          <div className="rounded-2xl border border-zinc-200/80 p-6 shadow-sm dark:border-zinc-800/80">
            <h2 className="text-lg font-medium">Email</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
              The best way to reach us for support, feedback, or press.
            </p>
            <div className="mt-4">
              <a
                href="mailto:support@imotara.com"
                className="inline-flex items-center rounded-lg border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
              >
                support@imotara.com
              </a>
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-200/80 p-6 shadow-sm dark:border-zinc-800/80">
            <h2 className="text-lg font-medium">Social</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
              Follow updates, announcements, and behind-the-scenes notes.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <a
                href="https://x.com/imotara"
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
              >
                X (Twitter)
              </a>
              <a
                href="https://www.linkedin.com/company/imotara"
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
              >
                LinkedIn
              </a>
              <a
                href="https://github.com/imotara"
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
              >
                GitHub
              </a>
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-200/80 p-6 shadow-sm dark:border-zinc-800/80">
            <h2 className="text-lg font-medium">Partnerships</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
              Research collaborations, well-being programs, or platform
              integrations.
            </p>
            <div className="mt-4">
              <a
                href="mailto:partnerships@imotara.com?subject=Partnership%20Inquiry"
                className="inline-flex items-center rounded-lg border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
              >
                partnerships@imotara.com
              </a>
            </div>
          </div>
        </section>

        {/* Contact form */}
        <section className="rounded-2xl border border-zinc-200/80 p-6 shadow-sm dark:border-zinc-800/80">
          <h2 className="text-lg font-medium">Send a message</h2>
          {!FORMSPREE_ID && (
            <p className="mt-2 text-sm text-amber-600 dark:text-amber-400">
              Tip: Set <code className="rounded bg-zinc-100 px-1.5 py-0.5 dark:bg-zinc-900">NEXT_PUBLIC_FORMSPREE_ID</code>{" "}
              in your environment to enable the contact form. Until then, it will open your mail client.
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
              <input type="hidden" name="_subject" value="New message from imotara.com" />
            )}

            <div className="grid gap-5 sm:grid-cols-2">
              <div className="flex flex-col">
                <label htmlFor="name" className="text-sm font-medium">
                  Name
                </label>
                <input
                  id="name"
                  name="name"
                  required
                  className="mt-2 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none ring-indigo-500/20 placeholder:text-zinc-400 focus:ring-2 dark:border-zinc-700 dark:bg-black"
                  placeholder="Your name"
                />
              </div>

              <div className="flex flex-col">
                <label htmlFor="email" className="text-sm font-medium">
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  className="mt-2 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none ring-indigo-500/20 placeholder:text-zinc-400 focus:ring-2 dark:border-zinc-700 dark:bg-black"
                  placeholder="you@example.com"
                />
              </div>
            </div>

            <div className="flex flex-col">
              <label htmlFor="topic" className="text-sm font-medium">
                Topic
              </label>
              <select
                id="topic"
                name="topic"
                className="mt-2 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none ring-indigo-500/20 focus:ring-2 dark:border-zinc-700 dark:bg-black"
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
              <label htmlFor="message" className="text-sm font-medium">
                Message
              </label>
              <textarea
                id="message"
                name="message"
                rows={5}
                required
                className="mt-2 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none ring-indigo-500/20 placeholder:text-zinc-400 focus:ring-2 dark:border-zinc-700 dark:bg-black"
                placeholder="How can we help?"
              />
            </div>

            <div className="flex items-start gap-3">
              <input
                id="consent"
                name="consent"
                type="checkbox"
                required
                className="mt-1 h-4 w-4 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500 dark:border-zinc-600"
              />
              <label htmlFor="consent" className="text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                I agree that Imotara may use this information to contact me about my request.
                See our{" "}
                <Link href="/privacy" className="underline hover:text-indigo-500">
                  Privacy Policy
                </Link>
                .
              </label>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="submit"
                className="rounded-lg bg-zinc-900 px-4 py-2 text-sm text-white transition hover:bg-zinc-800 dark:bg-zinc-100 dark:text-black dark:hover:bg-zinc-200"
              >
                Send message
              </button>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Response time: typically 1–2 business days.
              </p>
            </div>
          </form>
        </section>
      </div>

      <p className="mt-10 text-xs text-zinc-500 dark:text-zinc-400">
        For urgent safety concerns, please contact local emergency services. Imotara is a reflective tool and not a substitute for professional care.
      </p>
    </main>
  );
}
