import Link from "next/link";
import PrivacyActionsPanel from "@/components/imotara/PrivacyActionsPanel";
import TopBar from "@/components/imotara/TopBar";

export const metadata = {
  title: "Privacy Policy — Imotara",
  description:
    "How Imotara collects, stores, and protects your data — with consent, clarity, and control.",
};

// Optional build label for quick debugging info
const BUILD_LABEL =
  process.env.NEXT_PUBLIC_IMOTARA_BUILD_LABEL ??
  "0.1.0 · local-first";

export default function PrivacyPage() {
  return (
    <>
      <TopBar
        title="Privacy Policy"
        showSyncChip={false}
        showConflictsButton={false}
      />

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
            <em>your feelings are yours</em>. We collect the minimum
            information necessary to provide the product, and we put consent,
            clarity, and control in your hands. Imotara is being designed for
            young people and families, not for ad-tracking or selling data.
          </p>
          <p className="mt-3 text-xs text-zinc-400">
            This page explains how data is handled in the current Imotara
            experience. If we introduce new data flows in the future, we will
            update this policy and ask for consent where required.
          </p>
          <p className="mt-3 text-xs text-zinc-500">
            Imotara is currently operated independently from India. For privacy-related
            inquiries, you may contact us at{" "}
            <a
              href="mailto:info@imotara.com"
              className="underline decoration-indigo-300/70 underline-offset-4 hover:text-indigo-200"
            >
              info@imotara.com
            </a>.
          </p>


        </section>

        {/* Content sections */}
        <div className="mt-8 space-y-6">
          {/* Scope */}
          <section className="imotara-glass-soft rounded-2xl p-6 shadow-md backdrop-blur-md">
            <h2 className="text-xl font-medium text-zinc-50">Scope</h2>
            <p className="mt-3 text-sm leading-7 text-zinc-300">
              This Privacy Policy applies to the Imotara web application, the Imotara iOS
              and Android mobile applications, and any cloud sync services associated
              with Imotara. It does not apply to third-party websites or services that
              may be linked from within the app.
            </p>
          </section>

          {/* Core Principles */}
          <section className="imotara-glass-soft rounded-2xl p-6 shadow-md backdrop-blur-md">
            <h2 className="text-xl font-medium text-zinc-50">Core Principles</h2>
            <ul className="mt-3 list-disc space-y-2 pl-6 text-sm text-zinc-300">
              <li>
                <strong>Consent-first</strong>: optional cloud and advanced features use
                clear opt-ins.
              </li>
              <li>
                <strong>Local-first</strong>: wherever possible, data stays on your
                device.
              </li>
              <li>
                <strong>Data minimization</strong>: we collect only what’s required to
                operate the service.
              </li>
              <li>
                <strong>No ad-tech</strong>: we do not run advertising tracking systems
                inside Imotara.
              </li>
              <li>
                <strong>No sale of personal data</strong>.
              </li>
              <li>
                <strong>User control</strong>: export and deletion options wherever
                technically feasible.
              </li>
            </ul>
          </section>

          {/* What We Collect */}
          <section className="imotara-glass-soft rounded-2xl p-6 shadow-md backdrop-blur-md">
            <h2 className="text-xl font-medium text-zinc-50">Information We Collect</h2>
            <p className="mt-3 text-sm leading-7 text-zinc-300">
              We collect information only when necessary to provide the service.
            </p>

            <div className="mt-4 space-y-4">
              <div>
                <p className="text-sm font-semibold text-zinc-100">
                  Account information (optional)
                </p>
                <p className="mt-1 text-sm leading-7 text-zinc-300">
                  Imotara can use an anonymous sign-in identifier to keep your synced data separated
                  without requiring email or phone. If you choose to upgrade to a full account in the
                  future (where available), we may collect an email address for authentication.
                </p>

              </div>

              <div>
                <p className="text-sm font-semibold text-zinc-100">
                  Anonymous identifier (default)
                </p>
                <p className="mt-1 text-sm leading-7 text-zinc-300">
                  Imotara may generate or use an anonymous sign-in identifier to keep your data separated
                  and to support optional cloud sync, without requiring your real name, email, or phone.
                </p>
              </div>


              <div>
                <p className="text-sm font-semibold text-zinc-100">User content</p>
                <p className="mt-1 text-sm leading-7 text-zinc-300">
                  When you use Imotara, you may choose to enter chat messages, journal
                  entries, reflections, emotion logs, and mood history. You control what
                  you choose to enter.
                </p>
              </div>

              <div>
                <p className="text-sm font-semibold text-zinc-100">
                  Device &amp; technical data
                </p>
                <p className="mt-1 text-sm leading-7 text-zinc-300">
                  To keep the app reliable, we may collect basic diagnostic data such as
                  app version, device type, operating system version, crash reports, and
                  anonymous performance metrics. We do not collect advertising
                  identifiers for tracking purposes.
                </p>
              </div>
            </div>
          </section>

          {/* Local-first architecture */}
          <section className="imotara-glass-soft rounded-2xl p-6 shadow-md backdrop-blur-md">
            <h2 className="text-xl font-medium text-zinc-50">
              Local-First Storage (Default)
            </h2>
            <p className="mt-3 text-sm leading-7 text-zinc-300">
              Imotara is designed to prioritize local processing. On both web and mobile,
              chat history, emotion logs, and preferences may be stored locally on your
              device to provide continuity and a better experience.
            </p>
            <p className="mt-3 text-sm leading-7 text-zinc-300">
              If you uninstall the app (mobile) or clear browser storage (web), locally
              stored data may be removed.
            </p>
          </section>

          {/* Cloud sync */}
          <section className="imotara-glass-soft rounded-2xl p-6 shadow-md backdrop-blur-md">
            <h2 className="text-xl font-medium text-zinc-50">Cloud Sync</h2>
            <p className="mt-3 text-sm leading-7 text-zinc-300">
              When cloud sync is enabled, Imotara stores a private copy of selected data on secure
              servers to support backup and multi-device continuity. Cloud sync is optional and can
              be turned off at any time.
            </p>

            <ul className="mt-3 list-disc space-y-2 pl-6 text-sm text-zinc-300">
              <li>Data is encrypted in transit (HTTPS/TLS).</li>
              <li>Data is protected with per-user access controls (row-level security) so only your account can access it.</li>
              <li>
                We use an <span className="text-zinc-100">anonymous sign-in</span> identifier to keep your synced data separated,
                even if you never provide email or phone.
              </li>
              <li>
                If you choose to share your name in the app (for example, “My preferred name is …”), it may be saved as an
                optional preference to personalize your experience.
              </li>
              <li>Your conversations are not publicly visible, not sold, and not used for advertising systems.</li>
              <li>You can request export or deletion using the controls on this page.</li>
            </ul>
          </section>

          <section className="imotara-glass-soft rounded-2xl p-6 shadow-md backdrop-blur-md">
            <h2 className="text-xl font-medium text-zinc-50">
              AI Processing &amp; Automated Responses
            </h2>
            <p className="mt-3 text-sm leading-7 text-zinc-300">
              Imotara uses artificial intelligence models to generate reflective and supportive
              responses to the messages you choose to enter. Some processing may occur locally
              on your device, while certain features may involve secure cloud-based AI services.
            </p>
            <p className="mt-3 text-sm leading-7 text-zinc-300">
              Your conversations are not sold and are not used for advertising systems. Where
              external AI service providers are used, data is processed under contractual
              safeguards and only for the purpose of generating responses within the app.
            </p>
            <p className="mt-3 text-sm leading-7 text-zinc-300">
              AI-generated responses are automated and may not always be perfect. Imotara is
              designed as a supportive companion and does not provide medical, legal, or
              crisis advice.
            </p>
          </section>


          {/* Legal basis */}
          <section className="imotara-glass-soft rounded-2xl p-6 shadow-md backdrop-blur-md">
            <h2 className="text-xl font-medium text-zinc-50">Legal Basis</h2>
            <p className="mt-3 text-sm leading-7 text-zinc-300">
              Depending on your jurisdiction, we process information to provide the
              service, based on user consent (for optional features), performance of the
              service, legitimate interests in security and reliability, and compliance
              with legal obligations where applicable. You may withdraw consent for
              optional cloud features at any time.
            </p>
          </section>

          {/* Retention */}
          <section className="imotara-glass-soft rounded-2xl p-6 shadow-md backdrop-blur-md">
            <h2 className="text-xl font-medium text-zinc-50">Data Retention</h2>
            <p className="mt-3 text-sm leading-7 text-zinc-300">
              Local data remains on your device unless you delete it or uninstall the
              app/clear browser storage. Cloud-synced data remains until you request
              deletion, delete your account, or retention limits require removal.
            </p>
          </section>

          {/* Your rights + actions */}
          <section className="imotara-glass-soft rounded-2xl p-6 shadow-md backdrop-blur-md">
            <h2 className="text-xl font-medium text-zinc-50">Your Rights &amp; Controls</h2>
            <ul className="mt-3 list-disc space-y-2 pl-6 text-sm text-zinc-300">
              <li>
                <strong>Export</strong>: request a machine-readable copy of your data.
              </li>
              <li>
                <strong>Delete</strong>: request deletion of cloud-stored history and/or
                account data (subject to legal/operational limits).
              </li>
              <li>
                <strong>Opt out</strong>: disable optional cloud features and consent-based
                processing where available.
              </li>
            </ul>

            {/* 🔐 Live Export/Delete controls */}
            <div className="mt-5">
              <PrivacyActionsPanel />
            </div>
          </section>

          {/* Children */}
          <section className="imotara-glass-soft rounded-2xl p-6 shadow-md backdrop-blur-md">
            <h2 className="text-xl font-medium text-zinc-50">Children</h2>
            <p className="mt-3 text-sm leading-7 text-zinc-300">
              Imotara is not directed to children under 13. If you believe a child has
              provided personal data, please contact us and we will take steps to delete
              it.
            </p>
          </section>

          {/* Sharing */}
          <section className="imotara-glass-soft rounded-2xl p-6 shadow-md backdrop-blur-md">
            <h2 className="text-xl font-medium text-zinc-50">
              Data Sharing &amp; Processors
            </h2>
            <p className="mt-3 text-sm leading-7 text-zinc-300">
              We do not sell personal data. We use a small number of service providers to run
              the app and deliver optional features, under contractual safeguards and our instructions.
            </p>

            <ul className="mt-3 list-disc space-y-2 pl-6 text-sm text-zinc-300">
              <li>
                <strong>Cloud database &amp; sync</strong>: Supabase (stores optional synced data with per-user access controls).
              </li>
              <li>
                <strong>AI response generation</strong>: a contracted AI service provider may process text you submit to generate replies (only for providing the feature).
              </li>
              <li>
                <strong>Hosting</strong>: our hosting providers deliver the web experience and APIs.
              </li>
            </ul>

            <p className="mt-3 text-sm leading-7 text-zinc-300">
              We may disclose information if required by law, to prevent harm, or to protect platform integrity.
            </p>
          </section>


          {/* International transfers */}
          <section className="imotara-glass-soft rounded-2xl p-6 shadow-md backdrop-blur-md">
            <h2 className="text-xl font-medium text-zinc-50">
              International Data Transfers
            </h2>
            <p className="mt-3 text-sm leading-7 text-zinc-300">
              If data is processed outside your country of residence, we take reasonable
              measures to ensure appropriate protection consistent with applicable laws.
            </p>
          </section>

          {/* Security */}
          <section className="imotara-glass-soft rounded-2xl p-6 shadow-md backdrop-blur-md">
            <h2 className="text-xl font-medium text-zinc-50">Security</h2>
            <p className="mt-3 text-sm leading-7 text-zinc-300">
              We use encrypted communication (HTTPS/TLS), access limitation, and
              infrastructure safeguards to protect your information. No system can
              guarantee absolute security, but we continuously improve protections.
            </p>
          </section>

          {/* Updates */}
          <section className="imotara-glass-soft rounded-2xl p-6 shadow-md backdrop-blur-md">
            <h2 className="text-xl font-medium text-zinc-50">Updates to this Policy</h2>
            <p className="mt-3 text-sm leading-7 text-zinc-300">
              We may update this policy as features evolve. We’ll post the new version
              here and, when appropriate, notify you in-app or via email.
            </p>
            <p className="mt-2 text-xs text-zinc-400">
              Effective date: Nov 1, 2025 • Last updated: Feb 14, 2026
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
                href="mailto:info@imotara.com"
                className="underline decoration-indigo-300/70 underline-offset-4 hover:text-indigo-200"
              >
                info@imotara.com
              </a>
              .
            </p>
          </section>
        </div>

        {/* Tiny build/version footer */}
        <footer className="mt-6 text-center text-[11px] text-zinc-500">
          Imotara · {BUILD_LABEL}
        </footer>
      </main>
    </>
  );
}
