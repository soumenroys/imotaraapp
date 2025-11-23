import Link from "next/link";

export const metadata = {
  title: "Privacy Policy — Imotara",
  description:
    "How Imotara collects, stores, and protects your data — with consent, clarity, and control.",
};

export default function PrivacyPage() {
  return (
    <main
      className="mx-auto w-full max-w-5xl px-4 py-16 text-zinc-50 sm:px-6"
      aria-labelledby="privacy-title"
    >
      {/* Hero / Intro */}
      <section className="imotara-glass-card rounded-2xl px-6 py-8 shadow-xl backdrop-blur-md sm:px-8 sm:py-10">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-400">
          Imotara · Privacy
        </p>
        <h1
          id="privacy-title"
          className="mt-3 text-3xl font-semibold tracking-tight text-zinc-50 sm:text-4xl"
        >
          Privacy Policy
        </h1>
        <p className="mt-5 leading-7 text-zinc-300">
          Imotara is built on a simple promise:{" "}
          <em>your feelings are yours</em>. We collect the minimum information
          necessary to provide the product, and we put consent, clarity, and
          control in your hands.
        </p>
        <p className="mt-3 text-xs text-zinc-400">
          This page describes how data is handled in the current preview and how
          we intend to evolve as more cloud features are added.
        </p>
      </section>

      {/* Content sections */}
      <div className="mt-8 space-y-6">
        {/* Core Principles */}
        <section className="imotara-glass-soft rounded-2xl p-6 shadow-md backdrop-blur-md">
          <h2 className="text-xl font-medium text-zinc-50">Core Principles</h2>
          <ul className="mt-3 list-disc space-y-2 pl-6 text-sm text-zinc-300">
            <li>
              <strong>Consent-first</strong>: features that need cloud use clear,
              explicit opt-ins.
            </li>
            <li>
              <strong>Minimalism by default</strong>: collect only what’s
              essential.
            </li>
            <li>
              <strong>Transparency</strong>: plain language, no dark patterns.
            </li>
            <li>
              <strong>Control</strong>: export and delete options wherever
              technically feasible.
            </li>
            <li>No ads, no sale of personal data.</li>
          </ul>
        </section>

        {/* What We Collect */}
        <section className="imotara-glass-soft rounded-2xl p-6 shadow-md backdrop-blur-md">
          <h2 className="text-xl font-medium text-zinc-50">What We Collect</h2>
          <p className="mt-3 text-sm text-zinc-300">
            Depending on your usage and settings:
          </p>
          <ul className="mt-3 list-disc space-y-2 pl-6 text-sm text-zinc-300">
            <li>
              <strong>Account basics</strong> (if you create an account): email
              and authentication data.
            </li>
            <li>
              <strong>App content</strong> you choose to enter (e.g., journal
              notes, reflections).
            </li>
            <li>
              <strong>Device &amp; usage</strong>: anonymous diagnostics to keep
              the app reliable.
            </li>
            <li>
              <strong>Optional cloud features</strong>: only when you opt in;
              we’ll explain the why and where.
            </li>
          </ul>
        </section>

        {/* Storage & Security */}
        <section className="imotara-glass-soft rounded-2xl p-6 shadow-md backdrop-blur-md">
          <h2 className="text-xl font-medium text-zinc-50">
            Storage &amp; Security
          </h2>
          <p className="mt-3 text-sm leading-7 text-zinc-300">
            We prioritize local processing where possible. For cloud-backed
            features, data is encrypted in transit and at rest. We use
            industry-standard controls, access minimization, and audits to
            protect your information.
          </p>
        </section>

        {/* Your Choices */}
        <section className="imotara-glass-soft rounded-2xl p-6 shadow-md backdrop-blur-md">
          <h2 className="text-xl font-medium text-zinc-50">Your Choices</h2>
          <ul className="mt-3 list-disc space-y-2 pl-6 text-sm text-zinc-300">
            <li>
              <strong>Export</strong>: request a machine-readable copy of your
              data.
            </li>
            <li>
              <strong>Delete</strong>: request deletion of your account and
              associated data (subject to legal/operational limits).
            </li>
            <li>
              <strong>Opt out</strong>: disable optional analytics or cloud
              features anytime.
            </li>
          </ul>
        </section>

        {/* Sharing with Third Parties */}
        <section className="imotara-glass-soft rounded-2xl p-6 shadow-md backdrop-blur-md">
          <h2 className="text-xl font-medium text-zinc-50">
            Sharing with Third Parties
          </h2>
          <p className="mt-3 text-sm leading-7 text-zinc-300">
            We don’t sell personal data. We may use vetted processors (e.g.,
            cloud infrastructure, analytics) bound by contracts to process data
            on our behalf and under our instructions. We may also disclose
            information if required by law or to prevent harm.
          </p>
        </section>

        {/* Children */}
        <section className="imotara-glass-soft rounded-2xl p-6 shadow-md backdrop-blur-md">
          <h2 className="text-xl font-medium text-zinc-50">Children</h2>
          <p className="mt-3 text-sm leading-7 text-zinc-300">
            Imotara is not directed to children under 13. If you believe a child
            has provided personal data, please contact us to remove it.
          </p>
        </section>

        {/* Updates */}
        <section className="imotara-glass-soft rounded-2xl p-6 shadow-md backdrop-blur-md">
          <h2 className="text-xl font-medium text-zinc-50">
            Updates to this Policy
          </h2>
          <p className="mt-3 text-sm leading-7 text-zinc-300">
            We may update this policy as features evolve. We’ll post the new
            version here and, when appropriate, notify you in-app or via email.
          </p>
          <p className="mt-2 text-xs text-zinc-400">
            Effective date: Nov 1, 2025 • Last updated: Nov 1, 2025
          </p>
        </section>

        {/* Contact */}
        <section className="imotara-glass-soft rounded-2xl p-6 shadow-md backdrop-blur-md">
          <h2 className="text-xl font-medium text-zinc-50">Contact</h2>
          <p className="mt-3 text-sm leading-7 text-zinc-300">
            Have a privacy question or request?{" "}
            <Link
              href="/connect"
              className="underline decoration-emerald-300/70 underline-offset-4 hover:text-emerald-200"
            >
              Contact us
            </Link>{" "}
            or email{" "}
            <a
              href="mailto:support@imotara.com"
              className="underline decoration-indigo-300/70 underline-offset-4 hover:text-indigo-200"
            >
              support@imotara.com
            </a>
            .
          </p>
        </section>
      </div>
    </main>
  );
}
