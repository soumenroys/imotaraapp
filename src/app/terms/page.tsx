import Link from "next/link";
import PageShell from "@/components/imotara/PageShell";

export const metadata = {
  title: "Terms of Service — Imotara",
  description:
    "The terms that govern your use of Imotara — responsibilities, disclaimers, and legal basics.",
};

export default function TermsPage() {
  return (
    <PageShell aria-labelledby="terms-title">
      {/* Hero / Intro */}
      <section className="imotara-glass-card rounded-2xl px-6 py-8 shadow-xl backdrop-blur-md sm:px-8 sm:py-10">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-400">
          Imotara · Terms
        </p>
        <h1
          id="terms-title"
          className="mt-3 text-3xl font-semibold tracking-tight text-zinc-50 sm:text-4xl"
        >
          Terms of Service
        </h1>
        <p className="mt-5 leading-7 text-zinc-300">
          By using Imotara, you agree to these terms. If you don’t agree, please
          don’t use the service.
        </p>
      </section>

      {/* 1) Eligibility & Accounts */}
      <section className="mt-8 imotara-glass-soft rounded-2xl p-6 shadow-md backdrop-blur-md">
        <h2 className="text-xl font-medium text-zinc-50">
          1) Eligibility &amp; Accounts
        </h2>
        <p className="mt-3 text-sm leading-7 text-zinc-300">
          You must be legally able to form a contract in your jurisdiction. Keep
          your credentials secure and inform us of any unauthorized use. We may
          suspend or terminate accounts that violate these terms.
        </p>
      </section>

      {/* 2) Acceptable Use */}
      <section className="mt-6 imotara-glass-soft rounded-2xl p-6 shadow-md backdrop-blur-md">
        <h2 className="text-xl font-medium text-zinc-50">2) Acceptable Use</h2>
        <ul className="mt-3 list-disc space-y-2 pl-6 text-sm text-zinc-300">
          <li>No illegal activity, harassment, or infringement of others’ rights.</li>
          <li>No reverse engineering, scraping, or service disruption attempts.</li>
          <li>No automated misuse or circumvention of access controls.</li>
        </ul>
      </section>

      {/* 3) Your Content */}
      <section className="mt-6 imotara-glass-soft rounded-2xl p-6 shadow-md backdrop-blur-md">
        <h2 className="text-xl font-medium text-zinc-50">3) Your Content</h2>
        <p className="mt-3 text-sm leading-7 text-zinc-300">
          You retain ownership of content you enter. You grant us a limited,
          revocable license to process that content solely to provide, maintain,
          and operate the features you use, consistent with our{" "}
          <Link
            href="/privacy"
            className="underline decoration-emerald-300/70 underline-offset-4 hover:text-emerald-200"
          >
            Privacy Policy
          </Link>
          .
        </p>

      </section>

      {/* 4) Feedback */}
      <section className="mt-6 imotara-glass-soft rounded-2xl p-6 shadow-md backdrop-blur-md">
        <h2 className="text-xl font-medium text-zinc-50">4) Feedback</h2>
        <p className="mt-3 text-sm leading-7 text-zinc-300">
          If you send suggestions or feedback, you allow us to use them without
          obligation, to improve Imotara.
        </p>
      </section>

      {/* 5) Disclaimers */}
      <section className="mt-6 imotara-glass-soft rounded-2xl p-6 shadow-md backdrop-blur-md">
        <h2 className="text-xl font-medium text-zinc-50">5) Disclaimers</h2>
        <p className="mt-3 text-sm leading-7 text-zinc-300">
          Imotara is provided “as is.” We make no warranties of fitness for a
          particular purpose, availability, or accuracy. Imotara is a reflective
          aid and{" "}
          <strong>not medical, psychological, or legal advice</strong>. Use of
          Imotara does{" "}
          <strong>
            not create a doctor–patient, therapist–client, or similar
            professional relationship
          </strong>
          . If you need help, please seek professional support.
        </p>
      </section>

      {/* 6) Liability */}
      <section className="mt-6 imotara-glass-soft rounded-2xl p-6 shadow-md backdrop-blur-md">
        <h2 className="text-xl font-medium text-zinc-50">6) Liability</h2>
        <p className="mt-3 text-sm leading-7 text-zinc-300">
          To the extent permitted by law, Imotara and its affiliates are not
          liable for indirect, incidental, special, consequential, or exemplary
          damages. Our total liability is limited to the amount you paid (if any)
          in the 12 months preceding the claim.
        </p>
      </section>

      {/* 7) Indemnity */}
      <section className="mt-6 imotara-glass-soft rounded-2xl p-6 shadow-md backdrop-blur-md">
        <h2 className="text-xl font-medium text-zinc-50">7) Indemnity</h2>
        <p className="mt-3 text-sm leading-7 text-zinc-300">
          You agree to indemnify and hold harmless Imotara from claims arising
          out of your misuse of the service or violation of these terms.
        </p>
      </section>

      {/* 8) Termination */}
      <section className="mt-6 imotara-glass-soft rounded-2xl p-6 shadow-md backdrop-blur-md">
        <h2 className="text-xl font-medium text-zinc-50">8) Termination</h2>
        <p className="mt-3 text-sm leading-7 text-zinc-300">
          You may stop using the service at any time. We may suspend or
          terminate access if you breach these terms or for operational/security
          reasons. Some sections (e.g., Liability, Indemnity) survive
          termination.
        </p>
      </section>

      {/* 9) Governing Law */}
      <section className="mt-6 imotara-glass-soft rounded-2xl p-6 shadow-md backdrop-blur-md">
        <h2 className="text-xl font-medium text-zinc-50">9) Governing Law</h2>
        <p className="mt-3 text-sm leading-7 text-zinc-300">
          These terms are governed by the laws of India. Courts in Kolkata, West
          Bengal, shall have exclusive jurisdiction, unless mandatory laws of
          your country require otherwise.
        </p>
      </section>

      {/* 10) Changes */}
      <section className="mt-6 imotara-glass-soft rounded-2xl p-6 shadow-md backdrop-blur-md">
        <h2 className="text-xl font-medium text-zinc-50">10) Changes</h2>
        <p className="mt-3 text-sm leading-7 text-zinc-300">
          We may update these terms as the product evolves. We’ll post updates
          here and, when appropriate, notify you in-app or via email. Your
          continued use means you accept the updated terms.
        </p>
        <p className="mt-2 text-xs text-zinc-400">
          Effective date: Nov 1, 2025 • Last updated: Nov 1, 2025
        </p>
      </section>

      {/* Contact */}
      <section className="mt-6 imotara-glass-soft rounded-2xl p-6 shadow-md backdrop-blur-md">
        <h2 className="text-xl font-medium text-zinc-50">Contact</h2>
        <p className="mt-3 text-sm leading-7 text-zinc-300">
          Questions about these terms?{" "}
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
    </PageShell>
  );
}
