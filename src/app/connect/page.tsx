/* src/app/connect/page.tsx */
import Link from "next/link";

export const metadata = {
  title: "Connect — Imotara",
  description:
    "Ways to reach the Imotara team for feedback, partnerships, or support.",
};

export default function ConnectPage() {
  return (
    <main
      className="mx-auto w-full max-w-5xl px-4 py-16 text-zinc-50 sm:px-6"
      aria-labelledby="connect-title"
    >
      {/* Header */}
      <header className="mb-10 max-w-3xl">
        <div className="imotara-glass-card rounded-2xl px-6 py-6 shadow-xl backdrop-blur-md sm:px-8 sm:py-8">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-400">
            Imotara · Connect
          </p>

          <h1
            id="connect-title"
            className="mt-3 text-3xl font-semibold tracking-tight text-zinc-50 sm:text-4xl"
          >
            Connect with the Imotara team
          </h1>

          <p className="mt-4 leading-7 text-zinc-300 sm:text-base">
            We’d love to hear from you — whether you’re sharing feedback,
            exploring partnerships, or need help. Choose a quick contact option
            or drop us a message using the form. Submitting the form will open
            your email app with the details pre-filled.
          </p>
        </div>
      </header>

      <div className="mt-6 grid gap-8 lg:grid-cols-2">
        {/* Quick contact cards */}
        <section className="space-y-4">
          {/* Email */}
          <div className="imotara-glass-soft rounded-2xl p-6 shadow-md backdrop-blur-md">
            <h2 className="text-lg font-medium text-zinc-50">Email</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-300">
              The best way to reach us for support, feedback, or press.
            </p>
            <div className="mt-4">
              <a
                href="mailto:info@imotara.com"
                className="inline-flex items-center rounded-full border border-white/20 bg-white/5 px-4 py-2 text-sm text-zinc-100 shadow-sm transition hover:bg-white/10"
              >
                info@imotara.com
              </a>
            </div>
          </div>

          {/* Social */}
          <div className="imotara-glass-soft rounded-2xl p-6 shadow-md backdrop-blur-md">
            <h2 className="text-lg font-medium text-zinc-50">Social</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-300">
              Follow updates, announcements, and behind-the-scenes notes.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              {[
                {
                  label: "X",
                  href: "https://x.com/imotara4me",
                  icon: (
                    <svg
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                      className="h-4 w-4"
                      fill="currentColor"
                    >
                      <path d="M18.9 2H22l-6.8 7.8L23 22h-6.8l-5.3-6.8L4.9 22H2l7.4-8.5L1 2h7l4.8 6.1L18.9 2Zm-1.2 18h1.7L7.3 3.9H5.5L17.7 20Z" />
                    </svg>
                  ),
                },
                {
                  label: "LinkedIn",
                  href: "https://linkedin.com/in/imotara-4me-5b77753b0",
                  icon: (
                    <svg
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                      className="h-4 w-4"
                      fill="currentColor"
                    >
                      <path d="M20.45 20.45h-3.55v-5.57c0-1.33-.03-3.04-1.86-3.04-1.86 0-2.14 1.45-2.14 2.95v5.66H9.35V9h3.41v1.56h.05c.48-.9 1.65-1.86 3.39-1.86 3.63 0 4.3 2.39 4.3 5.49v6.26ZM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12ZM7.11 20.45H3.57V9h3.54v11.45ZM22 2H2v20h20V2Z" />
                    </svg>
                  ),
                },
                // {
                //   label: "Facebook",
                //   href: "https://facebook.com/imotara",
                //   icon: (
                //     <svg
                //       viewBox="0 0 24 24"
                //       aria-hidden="true"
                //       className="h-4 w-4"
                //       fill="currentColor"
                //     >
                //       <path d="M22 12a10 10 0 1 0-11.63 9.87v-6.99H7.9V12h2.47V9.8c0-2.44 1.45-3.8 3.67-3.8 1.06 0 2.17.19 2.17.19v2.39h-1.22c-1.21 0-1.59.75-1.59 1.52V12h2.7l-.43 2.88h-2.27v6.99A10 10 0 0 0 22 12Z" />
                //     </svg>
                //   ),
                // },
              ].map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-3 py-1.5 text-sm text-zinc-100 shadow-sm transition hover:bg-white/10"
                  aria-label={`Open Imotara on ${item.label}`}
                >
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/15 bg-black/30">
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </a>
              ))}
            </div>
          </div>

          {/* Partnerships */}
          <div className="imotara-glass-soft rounded-2xl p-6 shadow-md backdrop-blur-md">
            <h2 className="text-lg font-medium text-zinc-50">Partnerships</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-300">
              Research collaborations, well-being programs, or platform
              integrations.
            </p>
            <div className="mt-4">
              <a
                href="mailto:info@imotara.com?subject=Partnership%20Inquiry"
                className="inline-flex items-center rounded-full border border-white/20 bg-white/5 px-4 py-2 text-sm text-zinc-100 shadow-sm transition hover:bg-white/10"
              >
                info@imotara.com
              </a>
            </div>
          </div>
        </section>

        {/* Contact form */}
        <section className="imotara-glass-card rounded-2xl p-6 shadow-xl backdrop-blur-md sm:p-7">
          <h2 className="text-lg font-medium text-zinc-50">Send a message</h2>

          <p className="mt-3 text-sm text-zinc-300">
            This form will open your default email app and pre-fill the message.
            You can review everything before sending.
          </p>

          <form
            action="mailto:support@imotara.com"
            method="GET"
            encType="text/plain"
            className="mt-6 space-y-5"
          >
            <div className="grid gap-5 sm:grid-cols-2">
              {/* Name */}
              <div className="flex flex-col">
                <label
                  htmlFor="name"
                  className="text-sm font-medium text-zinc-100"
                >
                  Name
                </label>
                <input
                  id="name"
                  name="name"
                  required
                  className="mt-2 rounded-lg border border-white/20 bg-black/40 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 outline-none focus:border-indigo-400/70 focus:ring-2 focus:ring-indigo-500/60"
                  placeholder="Your name"
                />
              </div>

              {/* Email */}
              <div className="flex flex-col">
                <label
                  htmlFor="email"
                  className="text-sm font-medium text-zinc-100"
                >
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  className="mt-2 rounded-lg border border-white/20 bg-black/40 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 outline-none focus:border-indigo-400/70 focus:ring-2 focus:ring-indigo-500/60"
                  placeholder="you@example.com"
                />
              </div>
            </div>

            {/* Topic */}
            <div className="flex flex-col">
              <label
                htmlFor="topic"
                className="text-sm font-medium text-zinc-100"
              >
                Topic
              </label>
              <select
                id="topic"
                name="topic"
                defaultValue="General"
                className="mt-2 w-full rounded-lg border border-white/20 bg-black/40 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-indigo-400/70 focus:ring-2 focus:ring-indigo-500/60"
              >
                <option>General</option>
                <option>Feedback</option>
                <option>Support</option>
                <option>Partnerships</option>
                <option>Press</option>
              </select>
            </div>

            {/* Message */}
            <div className="flex flex-col">
              <label
                htmlFor="message"
                className="text-sm font-medium text-zinc-100"
              >
                Message
              </label>
              <textarea
                id="message"
                name="message"
                rows={5}
                required
                className="mt-2 rounded-lg border border-white/20 bg-black/40 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 outline-none focus:border-indigo-400/70 focus:ring-2 focus:ring-indigo-500/60"
                placeholder="How can we help?"
              />
            </div>

            {/* Consent */}
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
                I agree that Imotara may use this information to contact me.
                See our{" "}
                <Link
                  href="/privacy"
                  className="underline decoration-emerald-300/70 underline-offset-4 hover:text-emerald-200"
                >
                  Privacy Policy
                </Link>
                .
              </label>
            </div>

            {/* Submit */}
            <div className="flex items-center gap-3">
              <button
                type="submit"
                className="rounded-full bg-gradient-to-r from-indigo-500 via-sky-500 to-emerald-400 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-sky-900/50 transition hover:brightness-110"
              >
                Open in email app
              </button>
              <p className="text-xs text-zinc-400">
                Your mail app will be opened with details pre-filled.
              </p>
            </div>
          </form>
        </section>
      </div>

      {/* Footer note */}
      <p className="mt-10 max-w-3xl text-xs text-zinc-400">
        For urgent safety concerns, please contact local emergency services.
        Imotara is a reflective tool and not a substitute for professional care.
      </p>
    </main>
  );
}
