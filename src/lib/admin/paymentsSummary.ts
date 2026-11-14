// src/lib/admin/paymentsSummary.ts
//
// #139 (owner, 14 Nov 2026): Admin → Licenses shows "Amount paid" and
// "Payment date" per person.
//
// 🔑 Owner's rule: the amount is WHAT THE CUSTOMER PAID, in their own currency,
// and the date is their LATEST payment. Free / grandfathered / manually granted
// licences show "—" — a licence is not a payment.
//
// ⚠️ Source is `payment_licenses`, NOT `payment_invoices`: measured 14 Nov, the
// invoice table holds 6 rows and misses every payment before mid-June (the May
// Apple and Razorpay ones); payment_licenses holds all 9, across Razorpay,
// Apple and Google Play. Amounts are in minor units (paise / cents).

export type PaymentRow = {
  user_id: string | null;
  amount_paise: number | null;
  currency: string | null;
  granted_at: string;
};

export type PaymentSummary = {
  /** Latest payment, in minor units of `lastCurrency`. */
  lastAmountMinor: number;
  lastCurrency: string;
  /** ISO timestamp of the latest payment. */
  lastPaidAt: string;
  /** How many payments this person has made. */
  count: number;
  /** Total of all payments — only when they are all in one currency. */
  totalMinor: number | null;
};

/** Group payment rows by person; the latest payment wins the headline. */
export function summarisePayments(rows: PaymentRow[]): Map<string, PaymentSummary> {
  const byUser = new Map<string, PaymentRow[]>();
  for (const r of rows) {
    if (!r.user_id) continue;
    const list = byUser.get(r.user_id) ?? [];
    list.push(r);
    byUser.set(r.user_id, list);
  }
  const out = new Map<string, PaymentSummary>();
  for (const [uid, list] of byUser) {
    list.sort((a, b) => Date.parse(b.granted_at) - Date.parse(a.granted_at));
    const last = list[0];
    const currencies = new Set(list.map((r) => (r.currency ?? "INR").toUpperCase()));
    out.set(uid, {
      lastAmountMinor: last.amount_paise ?? 0,
      lastCurrency: (last.currency ?? "INR").toUpperCase(),
      lastPaidAt: last.granted_at,
      count: list.length,
      totalMinor: currencies.size === 1 ? list.reduce((s, r) => s + (r.amount_paise ?? 0), 0) : null,
    });
  }
  return out;
}

/** "₹149.00", "$4.99" — the amount as the customer saw it. */
export function formatMoney(minor: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency }).format(minor / 100);
  } catch {
    return `${(minor / 100).toFixed(2)} ${currency}`;
  }
}
