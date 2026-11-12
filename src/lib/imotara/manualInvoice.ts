// src/lib/imotara/manualInvoice.ts — #132 F part 2 (12 Nov 2026): an invoice the admin writes by hand,
// for an organisation that pays by bank transfer or UPI (a pilot becoming paid).
//
// It lives in the same payment_invoices table as every store/Razorpay receipt, so the org owner
// sees it in Settings → Invoices and opens it at /api/invoice/<id> like any other.
//   · payment_gateway = "manual"
//   · status "due" until money arrives, then "paid" (with the bank reference)
//   · issued to the org OWNER (user_id is NOT NULL) and tagged with org_id
// ⛔ No GST line: M/S IMOTARA is not GST-registered (below the threshold, owner 21 Oct).
// Pure — tested ⇒ ngoPilotPath.test.ts

export const MANUAL_GATEWAY = "manual";
export type ManualInvoiceStatus = "due" | "paid";
export const MAX_INVOICE_INR = 1_000_000; // ₹10 lakh: a typo guard, not a business rule

export type ManualInvoiceInput = {
  description?: unknown;
  amount_inr?: unknown;
  status?: unknown;
  reference?: unknown;
  period_start?: unknown;
  period_end?: unknown;
};

export type ManualInvoiceRow = {
  user_id: string;
  org_id: string;
  product_id: string;
  tier: string | null;
  description: string;
  payment_gateway: string;
  gateway_ref: string;
  amount_paise: number;
  currency: string;
  period_start: string | null;
  period_end: string | null;
  status: ManualInvoiceStatus;
  issued_at: string;
};

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Validate what the admin typed and build the row. Errors are plain sentences for the form. */
export function buildManualInvoice(
  input: ManualInvoiceInput,
  org: { id: string; slug: string; tier: string | null; ownerUserId: string | null },
  now: Date = new Date(),
): { ok: true; row: ManualInvoiceRow } | { ok: false; error: string } {
  if (!org.ownerUserId) return { ok: false, error: "This organisation has no owner yet — add the owner first; the invoice is issued to them." };

  const description = typeof input.description === "string" ? input.description.trim() : "";
  if (!description) return { ok: false, error: "Write what the invoice is for." };
  if (description.length > 200) return { ok: false, error: "Keep the description under 200 characters." };

  const amount = typeof input.amount_inr === "number" ? input.amount_inr : Number(input.amount_inr);
  if (!Number.isFinite(amount) || amount <= 0) return { ok: false, error: "Enter the amount in rupees (more than 0)." };
  if (amount > MAX_INVOICE_INR) return { ok: false, error: "That amount looks too large — check for an extra zero." };

  const status: ManualInvoiceStatus = input.status === "paid" ? "paid" : "due";
  const reference = typeof input.reference === "string" ? input.reference.trim() : "";
  if (status === "paid" && !reference) return { ok: false, error: "A paid invoice needs the bank / UPI reference." };

  const ps = typeof input.period_start === "string" && input.period_start ? input.period_start : null;
  const pe = typeof input.period_end === "string" && input.period_end ? input.period_end : null;
  if ((ps && !DATE.test(ps)) || (pe && !DATE.test(pe))) return { ok: false, error: "Dates must be YYYY-MM-DD." };
  if (ps && pe && pe <= ps) return { ok: false, error: "The period must end after it starts." };

  const stamp = now.toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
  return {
    ok: true,
    row: {
      user_id: org.ownerUserId,
      org_id: org.id,
      product_id: "org_manual",
      tier: org.tier,
      description,
      payment_gateway: MANUAL_GATEWAY,
      // (gateway, ref) is unique per payment ⇒ a bank reference when paid, else a stamped placeholder.
      gateway_ref: status === "paid" ? reference : `MANUAL-${org.slug}-${stamp}`,
      amount_paise: Math.round(amount * 100),
      currency: "INR",
      period_start: ps,
      period_end: pe,
      status,
      issued_at: now.toISOString(),
    },
  };
}
