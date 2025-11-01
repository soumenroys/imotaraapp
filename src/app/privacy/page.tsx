import Link from "next/link";

export const metadata = {
  title: "Privacy Policy — Imotara",
  description:
    "How Imotara collects, stores, and protects your data — with consent, clarity, and control.",
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-16 text-zinc-900 dark:text-zinc-100">
      <h1 className="text-3xl font-semibold tracking-tight">Privacy Policy</h1>
      <p className="mt-6 leading-7 text-zinc-600 dark:text-zinc-400">
        Imotara is built on a simple promise: <em>your feelings are yours</em>.
        We collect the minimum information necessary to provide the product,
        and we put consent, clarity, and control in your hands.
      </p>

      <section className="mt-10 space-y-4">
        <h2 className="text-xl font-medium">Core Principles</h2>
        <ul className="list-disc pl-6 text-zinc-600 dark:text-zinc-400">
          <li>Consent-first: features that need cloud use clear, explicit opt-ins.</li>
          <li>Minimalism by default: collect only what’s essential.</li>
          <li>Transparency: plain language, no dark patterns.</li>
          <li>Control: export and delete options wherever technically feasible.</li>
          <li>No ads, no sale of personal data.</li>
        </ul>
      </section>

      <section className="mt-10 space-y-3">
        <h2 className="text-xl font-medium">What We Collect</h2>
        <p className="text-zinc-600 dark:text-zinc-400">
          Depending on your usage and settings:
        </p>
        <ul className="list-disc pl-6 text-zinc-600 dark:text-zinc-400">
          <li>
            <strong>Account basics</strong> (if you create an account): email and authentication data.
          </li>
          <li>
            <strong>App content</strong> you choose to enter (e.g., journal notes, reflections).
          </li>
          <li>
            <strong>Device &amp; usage</strong>: anonymous diagnostics to keep the app reliable.
          </li>
          <li>
            <strong>Optional cloud features</strong>: only when you opt in; we’ll explain the why and where.
          </li>
        </ul>
      </section>

      <section className="mt-10 space-y-3">
        <h2 className="text-xl font-medium">Storage &amp; Security</h2>
        <p className="text-zinc-600 dark:text-zinc-400">
          We prioritize local processing where possible. For cloud-backed features, data is encrypted in transit and at rest. We use industry-standard controls, access minimization, and audits to protect your information.
        </p>
      </section>

      <section className="mt-10 space-y-3">
        <h2 className="text-xl font-medium">Your Choices</h2>
        <ul className="list-disc pl-6 text-zinc-600 dark:text-zinc-400">
          <li>
            <strong>Export</strong>: request a machine-readable copy of your data.
          </li>
          <li>
            <strong>Delete</strong>: request deletion of your account and associated data (subject to legal/operational limits).
          </li>
          <li>
            <strong>Opt out</strong>: disable optional analytics or cloud features anytime.
          </li>
        </ul>
      </section>

      <section className="mt-10 space-y-3">
        <h2 className="text-xl font-medium">Sharing with Third Parties</h2>
        <p className="text-zinc-600 dark:text-zinc-400">
          We don’t sell personal data. We may use vetted processors (e.g., cloud infrastructure, analytics) bound by contracts to process data on our behalf and under our instructions. We may also disclose information if required by law or to prevent harm.
        </p>
      </section>

      <section className="mt-10 space-y-3">
        <h2 className="text-xl font-medium">Children</h2>
        <p className="text-zinc-600 dark:text-zinc-400">
          Imotara is not directed to children under 13. If you believe a child has provided personal data, please contact us to remove it.
        </p>
      </section>

      <section className="mt-10 space-y-3">
        <h2 className="text-xl font-medium">Updates to this Policy</h2>
        <p className="text-zinc-600 dark:text-zinc-400">
          We may update this policy as features evolve. We’ll post the new version here and, when appropriate, notify you in-app or via email.
        </p>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Effective date: Nov 1, 2025 • Last updated: Nov 1, 2025
        </p>
      </section>

      <section className="mt-10 space-y-3">
        <h2 className="text-xl font-medium">Contact</h2>
        <p className="text-zinc-600 dark:text-zinc-400">
          Have a privacy question or request?{" "}
          <Link href="/connect" className="underline hover:text-indigo-500">
            Contact us
          </Link>{" "}
          or email <a href="mailto:support@imotara.com" className="underline">support@imotara.com</a>.
        </p>
      </section>
    </main>
  );
}
