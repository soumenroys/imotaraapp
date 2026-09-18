import Link from "next/link";
import PageShell from "@/components/imotara/PageShell";
import { BUSINESS } from "@/lib/imotara/businessIdentity";
import { INDIA_CRISIS_RESOURCES } from "@/lib/safety/crisisResources";

export const metadata = {
  title: "Contact Us — Imotara",
  description:
    "How to reach Imotara — support email, phone, and our registered business address. Not a crisis service.",
};

export default function ContactPage() {
  return (
    <PageShell aria-labelledby="contact-title">
      {/* Hero */}
      <section className="imotara-glass-card rounded-2xl px-6 py-8 shadow-xl backdrop-blur-md sm:px-8 sm:py-10">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-400">
          Imotara · Contact
        </p>
        <h1
          id="contact-title"
          className="mt-3 text-3xl font-semibold tracking-tight text-zinc-50 sm:text-4xl"
        >
          Contact Us
        </h1>
        <p className="mt-5 leading-7 text-zinc-300">
          A real person reads every message. We aim to reply within{" "}
          {BUSINESS.supportResponseTarget}.
        </p>
      </section>

      {/* ⚠️ Crisis first — before any support detail. Someone in distress should
          not have to read past a billing address to find a helpline. */}
      <section className="mt-8 rounded-2xl border border-rose-400/25 bg-rose-500/[0.07] p-6 shadow-md backdrop-blur-md">
        <h2 className="text-xl font-medium text-rose-100">
          If you are in crisis, please don&rsquo;t write to us &mdash; call
        </h2>
        <p className="mt-3 text-sm leading-7 text-zinc-300">
          Imotara is <strong className="text-zinc-100">not a medical, emergency or
          crisis service</strong>, and this inbox is not monitored around the
          clock. If you are in danger or thinking of harming yourself, contact
          trained help now &mdash; it is free and available 24/7.
        </p>

        <dl className="mt-4 space-y-3">
          {INDIA_CRISIS_RESOURCES.emergency && (
            <div className="rounded-xl border border-rose-400/20 bg-rose-500/[0.06] px-4 py-3">
              <dt className="text-sm font-medium text-rose-100">
                {INDIA_CRISIS_RESOURCES.emergency.label} (India) ·{" "}
                <span className="font-semibold">
                  {INDIA_CRISIS_RESOURCES.emergency.contact}
                </span>
              </dt>
              <dd className="mt-1 text-xs leading-6 text-zinc-400">
                {INDIA_CRISIS_RESOURCES.emergency.note}
              </dd>
            </div>
          )}
          {INDIA_CRISIS_RESOURCES.primary.map((r) => (
            <div key={r.id} className="px-4">
              <dt className="text-sm text-zinc-200">
                {r.label} ·{" "}
                <span className="font-semibold text-zinc-100">{r.contact}</span>
              </dt>
              {r.note && (
                <dd className="mt-0.5 text-xs leading-6 text-zinc-400">{r.note}</dd>
              )}
            </div>
          ))}
        </dl>

        <p className="mt-4 text-xs leading-6 text-zinc-400">
          Outside India, call your local emergency number. Imotara shows
          helplines for your own country inside the app.
        </p>
      </section>

      {/* Support channels */}
      <section className="mt-6 imotara-glass-soft rounded-2xl p-6 shadow-md backdrop-blur-md">
        <h2 className="text-xl font-medium text-zinc-50">How to reach us</h2>

        <dl className="mt-4 grid gap-5 sm:grid-cols-2">
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
              Email &mdash; the fastest way
            </dt>
            <dd className="mt-1.5 text-sm leading-7 text-zinc-300">
              <a
                href={`mailto:${BUSINESS.email}`}
                className="underline decoration-indigo-300/70 underline-offset-4 hover:text-indigo-200"
              >
                {BUSINESS.email}
              </a>
              <span className="block text-xs text-zinc-500">
                Billing, accounts, privacy requests, anything else.
              </span>
            </dd>
          </div>

          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
              Phone
            </dt>
            <dd className="mt-1.5 text-sm leading-7 text-zinc-300">
              <a
                href={`tel:${BUSINESS.phone}`}
                className="underline decoration-emerald-300/70 underline-offset-4 hover:text-emerald-200"
              >
                {BUSINESS.phoneDisplay}
              </a>
              <span className="block text-xs text-zinc-500">
                {BUSINESS.phoneHours}. Not a counselling line.
              </span>
            </dd>
          </div>

          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
              Refunds &amp; cancellations
            </dt>
            <dd className="mt-1.5 text-sm leading-7 text-zinc-300">
              <Link
                href="/refunds"
                className="underline decoration-emerald-300/70 underline-offset-4 hover:text-emerald-200"
              >
                Read the policy
              </Link>
              <span className="block text-xs text-zinc-500">
                Who to ask depends on where you bought &mdash; the policy explains.
              </span>
            </dd>
          </div>

          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
              Help centre
            </dt>
            <dd className="mt-1.5 text-sm leading-7 text-zinc-300">
              <Link
                href="/help"
                className="underline decoration-indigo-300/70 underline-offset-4 hover:text-indigo-200"
              >
                Browse answers
              </Link>
              <span className="block text-xs text-zinc-500">
                Most questions are answered there already.
              </span>
            </dd>
          </div>
        </dl>
      </section>

      {/* Registered business details — what a payment aggregator verifies */}
      <section className="mt-6 imotara-glass-soft rounded-2xl p-6 shadow-md backdrop-blur-md">
        <h2 className="text-xl font-medium text-zinc-50">Registered office</h2>
        <p className="mt-3 text-sm leading-7 text-zinc-300">
          Imotara is operated by{" "}
          <strong className="text-zinc-100">{BUSINESS.legalName}</strong>, a{" "}
          {BUSINESS.entityType.toLowerCase()} registered in India.
        </p>
        <address className="mt-3 not-italic text-sm leading-7 text-zinc-300">
          {BUSINESS.address.line1}
          <br />
          {BUSINESS.address.locality}, {BUSINESS.address.city}
          <br />
          {BUSINESS.address.state} &ndash; {BUSINESS.address.postalCode}
          <br />
          {BUSINESS.address.country}
        </address>
        <p className="mt-3 text-xs leading-6 text-zinc-500">
          This is a registered business address for correspondence, not a walk-in
          office or clinic. Please write or call before visiting.
        </p>
      </section>

      {/* Cross-links */}
      <section className="mt-6 imotara-glass-soft rounded-2xl p-6 shadow-md backdrop-blur-md">
        <h2 className="text-xl font-medium text-zinc-50">Also useful</h2>
        <ul className="mt-3 list-disc space-y-2 pl-6 text-sm text-zinc-300">
          <li>
            <Link
              href="/privacy"
              className="underline decoration-emerald-300/70 underline-offset-4 hover:text-emerald-200"
            >
              Privacy Policy
            </Link>{" "}
            &mdash; including how to request your data or deletion.
          </li>
          <li>
            <Link
              href="/terms"
              className="underline decoration-emerald-300/70 underline-offset-4 hover:text-emerald-200"
            >
              Terms of Service
            </Link>
          </li>
          <li>
            <Link
              href="/connect/wallet-terms"
              className="underline decoration-emerald-300/70 underline-offset-4 hover:text-emerald-200"
            >
              Wallet Terms
            </Link>{" "}
            &mdash; balance validity, dormancy and wallet refunds.
          </li>
        </ul>
      </section>
    </PageShell>
  );
}
