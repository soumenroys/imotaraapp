import Link from "next/link";
import PageShell from "@/components/imotara/PageShell";
import { BUSINESS } from "@/lib/imotara/businessIdentity";

export const metadata = {
  title: "Refund & Cancellation Policy — Imotara",
  description:
    "How to cancel an Imotara plan and how refunds work — on the web, on iOS and on Android.",
};

/** Small helper so every section renders identically. */
function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-6 imotara-glass-soft rounded-2xl p-6 shadow-md backdrop-blur-md">
      <h2 className="text-xl font-medium text-zinc-50">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-7 text-zinc-300">
        {children}
      </div>
    </section>
  );
}

export default function RefundsPage() {
  return (
    <PageShell aria-labelledby="refunds-title">
      {/* Hero */}
      <section className="imotara-glass-card rounded-2xl px-6 py-8 shadow-xl backdrop-blur-md sm:px-8 sm:py-10">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-400">
          Imotara · Refunds
        </p>
        <h1
          id="refunds-title"
          className="mt-3 text-3xl font-semibold tracking-tight text-zinc-50 sm:text-4xl"
        >
          Refund &amp; Cancellation Policy
        </h1>
        <p className="mt-5 leading-7 text-zinc-300">
          Imotara is free to use. If you chose to pay and it wasn&rsquo;t right for
          you, we would rather give the money back than keep an unhappy
          subscriber.
        </p>
      </section>

      {/* The one thing that decides everything else */}
      <Section title="1) Where you bought decides who refunds you">
        <p>
          This is the part people most often get stuck on, so it comes first.
          Imotara sells through three different channels, and only one of them
          bills you directly.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[34rem] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 text-[11px] uppercase tracking-[0.14em] text-zinc-500">
                <th className="py-2 pr-4 font-semibold">You bought on</th>
                <th className="py-2 pr-4 font-semibold">Who charged you</th>
                <th className="py-2 font-semibold">Who refunds</th>
              </tr>
            </thead>
            <tbody className="text-zinc-300">
              <tr className="border-b border-white/5">
                <td className="py-3 pr-4">imotara.com (web)</td>
                <td className="py-3 pr-4">{BUSINESS.legalName}, via Razorpay</td>
                <td className="py-3 font-medium text-emerald-200">We do &mdash; write to us</td>
              </tr>
              <tr className="border-b border-white/5">
                <td className="py-3 pr-4">iPhone / iPad (App Store)</td>
                <td className="py-3 pr-4">Apple</td>
                <td className="py-3">Apple &mdash; we cannot</td>
              </tr>
              <tr>
                <td className="py-3 pr-4">Android (Google Play)</td>
                <td className="py-3 pr-4">Google</td>
                <td className="py-3">Google, or us via Play</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-xs leading-6 text-zinc-500">
          Apple and Google are the sellers of record for purchases made inside
          their apps. That is their rule, not ours &mdash; the money never reaches us
          in a form we can reverse. Check the receipt emailed to you if you
          aren&rsquo;t sure which one charged you.
        </p>
      </Section>

      {/* Cancellation */}
      <Section title="2) Cancelling">
        <p>
          <strong className="text-zinc-100">On the web, there is nothing to
          cancel.</strong> Web purchases are one-time payments that unlock Imotara
          Plus for a fixed number of days. Nothing renews automatically and no
          card is stored or charged again. When the period ends, your account
          simply returns to the free tier &mdash; your history and settings stay put.
        </p>
        <p>
          <strong className="text-zinc-100">In the apps, subscriptions renew
          automatically</strong> until you cancel them:
        </p>
        <ul className="list-disc space-y-2 pl-6">
          <li>
            <strong className="text-zinc-200">iPhone / iPad:</strong> Settings &rarr;
            your name &rarr; Subscriptions &rarr; Imotara &rarr; Cancel Subscription.
          </li>
          <li>
            <strong className="text-zinc-200">Android:</strong> Play Store &rarr;
            profile &rarr; Payments &amp; subscriptions &rarr; Subscriptions &rarr;
            Imotara &rarr; Cancel.
          </li>
        </ul>
        <p>
          Cancel at least <strong className="text-zinc-100">24 hours before</strong>{" "}
          the renewal date, or that renewal still goes through. Cancelling stops
          future charges; it does not shorten the period you have already paid
          for, and you keep Plus until that period ends.
        </p>
        <p className="text-xs leading-6 text-zinc-500">
          Deleting the app does not cancel a subscription. The subscription lives
          with Apple or Google, not with the app on your phone.
        </p>
      </Section>

      {/* The actual refund terms */}
      <Section title="3) Refunds on purchases made at imotara.com">
        <p>
          For anything you bought directly from us on the web:
        </p>
        <ul className="list-disc space-y-2 pl-6">
          <li>
            <strong className="text-zinc-200">Plus plans</strong> &mdash; full refund
            if you ask within <strong className="text-zinc-100">3 days</strong> of
            paying. No form, no reason required.
          </li>
          <li>
            <strong className="text-zinc-200">Token packs</strong> &mdash; full refund
            within <strong className="text-zinc-100">3 days</strong>, provided none
            of the tokens have been spent. Once tokens are used they are consumed
            and cannot be returned.
          </li>
          <li>
            <strong className="text-zinc-200">Duplicate or failed payments</strong>{" "}
            &mdash; refunded in full whenever you notice, with no time limit. If
            money left your account and no plan was unlocked, that is our
            problem to fix.
          </li>
          <li>
            <strong className="text-zinc-200">Wallet balances for Connect</strong>{" "}
            follow their own rules &mdash; see the{" "}
            <Link
              href="/connect/wallet-terms"
              className="underline decoration-emerald-300/70 underline-offset-4 hover:text-emerald-200"
            >
              Wallet Terms
            </Link>
            . In short: your balance is refundable on request, and no fee is
            charged on a wallet refund.
          </li>
        </ul>
        <p>
          Outside the 3-day window we will still look at genuine cases &mdash; an
          accidental purchase, a plan bought twice, a feature that did not work
          for you. Write to us and say what happened.
        </p>
      </Section>

      <Section title="4) What we can&rsquo;t refund">
        <ul className="list-disc space-y-2 pl-6">
          <li>Tokens that have already been spent.</li>
          <li>
            Connect sessions that have already taken place, once the companion
            has been paid for their time.
          </li>
          <li>
            Periods of a plan that have already elapsed &mdash; if you used Plus for
            five months of a year, we refund the unused remainder at most, not
            the whole year.
          </li>
          <li>
            Accounts terminated for abuse or for breaching the{" "}
            <Link
              href="/terms"
              className="underline decoration-emerald-300/70 underline-offset-4 hover:text-emerald-200"
            >
              Terms of Service
            </Link>
            .
          </li>
        </ul>
      </Section>

      <Section title="5) How to ask, and how long it takes">
        <p>
          Email{" "}
          <a
            href={`mailto:${BUSINESS.email}?subject=Refund%20request`}
            className="underline decoration-indigo-300/70 underline-offset-4 hover:text-indigo-200"
          >
            {BUSINESS.email}
          </a>{" "}
          from the address on your Imotara account, with the payment or order ID
          from your receipt. That is all we need.
        </p>
        <ul className="list-disc space-y-2 pl-6">
          <li>
            We reply within{" "}
            <strong className="text-zinc-100">
              {BUSINESS.supportResponseTarget}
            </strong>
            .
          </li>
          <li>
            Approved refunds are initiated within{" "}
            <strong className="text-zinc-100">3 business days</strong>.
          </li>
          <li>
            The money reaches your original payment method in{" "}
            <strong className="text-zinc-100">5&ndash;7 business days</strong> after
            that &mdash; the exact timing is set by your bank or card issuer, not by
            us. Wallet refunds are processed within 7 business days.
          </li>
        </ul>
        <p>
          Refunds always go back to the method you paid with. We cannot redirect
          one to a different card, account or person.
        </p>
        <p className="text-xs leading-6 text-zinc-500">
          If something looks wrong on your statement, please write to us before
          raising a chargeback with your bank. A chargeback freezes the payment
          for weeks and usually suspends the account while it is investigated;
          an email to us is almost always faster.
        </p>
      </Section>

      <Section title="6) Who you are dealing with">
        <p>
          Imotara is operated by{" "}
          <strong className="text-zinc-100">{BUSINESS.legalName}</strong>,{" "}
          {BUSINESS.address.line1}, {BUSINESS.address.locality},{" "}
          {BUSINESS.address.city}, {BUSINESS.address.state} &ndash;{" "}
          {BUSINESS.address.postalCode}, {BUSINESS.address.country}. Full contact
          details are on the{" "}
          <Link
            href="/contact"
            className="underline decoration-emerald-300/70 underline-offset-4 hover:text-emerald-200"
          >
            Contact page
          </Link>
          .
        </p>
        <p>
          This policy is governed by the laws of India, and courts in Kolkata,
          West Bengal have exclusive jurisdiction &mdash; the same terms as our{" "}
          <Link
            href="/terms"
            className="underline decoration-emerald-300/70 underline-offset-4 hover:text-emerald-200"
          >
            Terms of Service
          </Link>
          . Nothing here limits rights you have under the consumer law of your
          own country where that law applies.
        </p>
        <p className="text-xs text-zinc-400">
          Effective date: Sep 18, 2026 &bull; Last updated: Sep 18, 2026
        </p>
      </Section>
    </PageShell>
  );
}
