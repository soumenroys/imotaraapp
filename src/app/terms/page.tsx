import Link from "next/link";

export const metadata = {
  title: "Terms of Service — Imotara",
  description:
    "The terms that govern your use of Imotara — responsibilities, disclaimers, and legal basics.",
};

export default function TermsPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-16 text-zinc-900 dark:text-zinc-100">
      <h1 className="text-3xl font-semibold tracking-tight">Terms of Service</h1>
      <p className="mt-6 leading-7 text-zinc-600 dark:text-zinc-400">
        By using Imotara, you agree to these terms. If you don’t agree, please don’t use the service.
      </p>

      <section className="mt-10 space-y-3">
        <h2 className="text-xl font-medium">1) Eligibility &amp; Accounts</h2>
        <p className="text-zinc-600 dark:text-zinc-400">
          You must be legally able to form a contract in your jurisdiction. Keep your credentials secure and inform us of any unauthorized use. We may suspend or terminate accounts that violate these terms.
        </p>
      </section>

      <section className="mt-10 space-y-3">
        <h2 className="text-xl font-medium">2) Acceptable Use</h2>
        <ul className="list-disc pl-6 text-zinc-600 dark:text-zinc-400">
          <li>No illegal activity, harassment, or infringement of others’ rights.</li>
          <li>No reverse engineering, scraping, or service disruption attempts.</li>
          <li>No automated misuse or circumvention of access controls.</li>
        </ul>
      </section>

      <section className="mt-10 space-y-3">
        <h2 className="text-xl font-medium">3) Your Content</h2>
        <p className="text-zinc-600 dark:text-zinc-400">
          You retain ownership of content you enter. You grant us a limited, revocable license to process that content solely to operate and improve the features you use, consistent with our{" "}
          <Link href="/privacy" className="underline hover:text-indigo-500">
            Privacy Policy
          </Link>.
        </p>
      </section>

      <section className="mt-10 space-y-3">
        <h2 className="text-xl font-medium">4) Feedback</h2>
        <p className="text-zinc-600 dark:text-zinc-400">
          If you send suggestions or feedback, you allow us to use them without obligation, to improve Imotara.
        </p>
      </section>

      <section className="mt-10 space-y-3">
        <h2 className="text-xl font-medium">5) Disclaimers</h2>
        <p className="text-zinc-600 dark:text-zinc-400">
          Imotara is provided “as is.” We make no warranties of fitness for a particular purpose, availability, or accuracy. Imotara is a reflective aid and <strong>not medical, psychological, or legal advice</strong>. If you need help, please seek professional support.
        </p>
      </section>

      <section className="mt-10 space-y-3">
        <h2 className="text-xl font-medium">6) Liability</h2>
        <p className="text-zinc-600 dark:text-zinc-400">
          To the extent permitted by law, Imotara and its affiliates are not liable for indirect, incidental, special, consequential, or exemplary damages. Our total liability is limited to the amount you paid (if any) in the 12 months preceding the claim.
        </p>
      </section>

      <section className="mt-10 space-y-3">
        <h2 className="text-xl font-medium">7) Indemnity</h2>
        <p className="text-zinc-600 dark:text-zinc-400">
          You agree to indemnify and hold harmless Imotara from claims arising out of your misuse of the service or violation of these terms.
        </p>
      </section>

      <section className="mt-10 space-y-3">
        <h2 className="text-xl font-medium">8) Termination</h2>
        <p className="text-zinc-600 dark:text-zinc-400">
          You may stop using the service at any time. We may suspend or terminate access if you breach these terms or for operational/security reasons. Some sections (e.g., Liability, Indemnity) survive termination.
        </p>
      </section>

      <section className="mt-10 space-y-3">
        <h2 className="text-xl font-medium">9) Governing Law</h2>
        <p className="text-zinc-600 dark:text-zinc-400">
          These terms are governed by the laws of India. Courts in Kolkata, West Bengal, shall have exclusive jurisdiction, unless mandatory laws of your country require otherwise.
        </p>
      </section>

      <section className="mt-10 space-y-3">
        <h2 className="text-xl font-medium">10) Changes</h2>
        <p className="text-zinc-600 dark:text-zinc-400">
          We may update these terms as the product evolves. We’ll post updates here and, when appropriate, notify you in-app or via email. Your continued use means you accept the updated terms.
        </p>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Effective date: Nov 1, 2025 • Last updated: Nov 1, 2025
        </p>
      </section>

      <section className="mt-10 space-y-3">
        <h2 className="text-xl font-medium">Contact</h2>
        <p className="text-zinc-600 dark:text-zinc-400">
          Questions about these terms?{" "}
          <Link href="/connect" className="underline hover:text-indigo-500">
            Contact us
          </Link>{" "}
          or email <a href="mailto:support@imotara.com" className="underline">support@imotara.com</a>.
        </p>
      </section>
    </main>
  );
}
