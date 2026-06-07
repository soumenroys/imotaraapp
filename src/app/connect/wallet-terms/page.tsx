// /connect/wallet-terms
// Imotara Wallet Terms & Policy — legally compliant with CPA 2019 (India).
// This page is linked from every wallet notification email and the top-up consent checkbox.

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Wallet Terms & Policy — Imotara",
  description: "Imotara Wallet balance validity, expiry, dormancy, and refund policy.",
};

const EFFECTIVE = "6 June 2026";
const SUPPORT   = "support@imotara.com";

export default function WalletTermsPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-12 text-zinc-300">
      <h1 className="text-2xl font-bold text-zinc-50 mb-1">Imotara Wallet Terms & Policy</h1>
      <p className="text-sm text-zinc-500 mb-8">Effective: {EFFECTIVE} · Version 1.0</p>

      <Section title="1. What is the Imotara Wallet?">
        <p>
          The Imotara Wallet is a closed-loop prepaid balance held within the Imotara platform.
          Balance can only be used to pay for sessions with Imotara wellness companions.
          It cannot be transferred to third parties, used at other merchants, or withdrawn as cash
          (except via the refund process described below).
        </p>
        <p className="mt-2">
          As a closed-loop instrument, the Imotara Wallet is exempt from RBI Prepaid Payment
          Instrument (PPI) regulations under RBI Master Directions on PPIs, 2021 (Clause 2.1).
          However, it is governed by the Consumer Protection Act, 2019 (India) and Imotara&apos;s
          Terms of Service.
        </p>
      </Section>

      <Section title="2. Validity & Inactivity Policy">
        <p>
          Your wallet balance remains active as long as you perform at least one of the following
          within any 24-month (2-year) period:
        </p>
        <ul className="mt-2 list-disc list-inside space-y-1 text-zinc-400">
          <li>Top up any amount to your wallet</li>
          <li>Book or complete a session with a companion</li>
        </ul>
        <p className="mt-2">
          The 2-year inactivity clock resets to zero every time you perform any of the above actions.
          There is no minimum top-up amount required to reset the clock.
        </p>
      </Section>

      <Section title="3. Reminder Notifications">
        <p>
          Imotara will send you <strong className="text-zinc-200">six email reminders</strong> before
          your balance becomes dormant, at the following intervals before the expiry date:
        </p>
        <div className="mt-3 rounded-xl border border-white/8 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/8 bg-white/3">
                <th className="text-left px-4 py-2 text-zinc-400 font-medium">Reminder</th>
                <th className="text-left px-4 py-2 text-zinc-400 font-medium">When Sent</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["1st", "180 days (6 months) before expiry"],
                ["2nd", "90 days (3 months) before expiry"],
                ["3rd", "30 days (1 month) before expiry"],
                ["4th", "14 days (2 weeks) before expiry"],
                ["5th", "7 days (1 week) before expiry"],
                ["6th (Final)", "1 day before expiry"],
              ].map(([label, when]) => (
                <tr key={label} className="border-b border-white/5">
                  <td className="px-4 py-2 text-zinc-300">{label}</td>
                  <td className="px-4 py-2 text-zinc-400">{when}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3">
          Reminders are sent to the email address registered with your Imotara account.
          Please ensure your email address is kept up to date.
          An annual wallet balance statement is also sent every 12 months.
        </p>
      </Section>

      <Section title="4. Dormancy">
        <p>
          If your balance remains unused for 2 years and you have not responded to the six reminder
          emails, your wallet will be marked <strong className="text-zinc-200">dormant</strong>.
        </p>
        <p className="mt-2">
          <strong className="text-zinc-200">Important:</strong> Dormancy does NOT mean your money is
          lost. Your balance is fully preserved in our system. A dormant wallet simply means the
          balance can no longer be used for sessions until either:
        </p>
        <ul className="mt-2 list-disc list-inside space-y-1 text-zinc-400">
          <li>You reactivate it with a new top-up, or</li>
          <li>You request a cash refund (see Section 5)</li>
        </ul>
        <p className="mt-2">
          A dormancy confirmation email is sent on the day your balance goes dormant, confirming
          the balance amount and your refund rights.
        </p>
      </Section>

      <Section title="5. Your Refund Rights">
        <p>
          After dormancy, you have a <strong className="text-zinc-200">1-year (365-day) grace period</strong>{" "}
          to request a full refund of your balance. No fees are charged on refunds.
        </p>
        <p className="mt-2">To request a refund:</p>
        <ul className="mt-2 list-disc list-inside space-y-1 text-zinc-400">
          <li>
            Use the <strong className="text-zinc-200">Request Refund</strong> button on the Wallet
            tab (easiest), or
          </li>
          <li>
            Email <strong className="text-zinc-200">{SUPPORT}</strong> with subject
            &quot;Wallet Refund Request — [your registered email]&quot;.
            Include your bank account number, IFSC code, and account holder name (or UPI ID).
          </li>
        </ul>
        <p className="mt-2">
          Refunds are processed within <strong className="text-zinc-200">7 business days</strong> of
          receiving verified bank details. You will receive a confirmation email with a reference number.
        </p>
        <p className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
          After the 1-year grace period following dormancy, unclaimed balances may be recognised as
          revenue by Imotara in accordance with applicable Indian accounting standards. However,
          Imotara will consider refund requests on a case-by-case basis even after this period.
        </p>
      </Section>

      <Section title="6. Consent">
        <p>
          By topping up your Imotara Wallet, you confirm that you have read and accepted these
          Wallet Terms. Your acceptance is recorded with a timestamp, the amount you topped up,
          and your device information, and is stored securely in our system as an audit record.
        </p>
      </Section>

      <Section title="7. Changes to This Policy">
        <p>
          Imotara may update this policy from time to time. You will be notified by email of any
          material changes at least 30 days before they take effect. Continued use of the wallet
          after the effective date constitutes acceptance of the updated terms.
        </p>
      </Section>

      <Section title="8. Governing Law & Disputes">
        <p>
          This policy is governed by the laws of India. Any disputes are subject to the Consumer
          Protection Act, 2019 and the jurisdiction of courts in Kolkata, West Bengal.
          For complaints, you may also approach the National Consumer Disputes Redressal Commission
          (NCDRC) or the relevant State Consumer Forum.
        </p>
      </Section>

      <div className="mt-10 rounded-xl border border-white/8 bg-white/3 px-5 py-4">
        <p className="text-sm font-semibold text-zinc-300 mb-1">Contact</p>
        <p className="text-sm text-zinc-500">
          For any wallet-related queries, email{" "}
          <a href={`mailto:${SUPPORT}`} className="text-violet-400 hover:underline">{SUPPORT}</a>.
        </p>
        <p className="mt-1 text-xs text-zinc-600">
          Imotara Wellness Pvt. Ltd. · India · Version 1.0 · Effective {EFFECTIVE}
        </p>
      </div>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="text-base font-semibold text-zinc-100 mb-3">{title}</h2>
      <div className="text-sm text-zinc-400 leading-relaxed">{children}</div>
    </section>
  );
}
