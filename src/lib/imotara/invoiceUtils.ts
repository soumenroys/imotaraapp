// src/lib/imotara/invoiceUtils.ts
// Utilities for creating and rendering payment invoices.

import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface InvoiceData {
  invoiceNumber: string;
  userId:        string;
  orgId?:        string | null;
  productId:     string;
  tier?:         string | null;
  description:   string;
  paymentGateway: "razorpay" | "apple" | "google_play" | "stripe";
  gatewayRef:    string;
  amountPaise:   number;
  currency:      string;
  periodStart?:  string | null;
  periodEnd?:    string | null;
}

/** Product display names for invoice descriptions. */
const PRODUCT_DESCRIPTIONS: Record<string, string> = {
  plus_monthly:  "Imotara Plus · Monthly subscription",
  plus_annual:   "Imotara Plus · Annual subscription",
  pro_monthly:   "Imotara Pro · Monthly subscription",
  pro_annual:    "Imotara Pro · Annual subscription",
  tokens_100:    "Imotara Token Pack · 100 tokens",
  tokens_250:    "Imotara Token Pack · 250 tokens",
  tokens_600:    "Imotara Token Pack · 600 tokens",
  tokens_1800:   "Imotara Token Pack · 1,800 tokens",
};

export function getProductDescription(productId: string): string {
  return PRODUCT_DESCRIPTIONS[productId] ?? `Imotara · ${productId}`;
}

/**
 * Creates an invoice record in the database.
 * Call this from every payment webhook/handler after confirming payment success.
 */
export async function createInvoice(
  admin: SupabaseClient,
  data:  Omit<InvoiceData, "invoiceNumber">
): Promise<{ id: string; invoiceNumber: string } | null> {
  const { data: invoice, error } = await admin
    .from("payment_invoices")
    .insert({
      user_id:         data.userId,
      org_id:          data.orgId    ?? null,
      product_id:      data.productId,
      tier:            data.tier     ?? null,
      description:     data.description,
      payment_gateway: data.paymentGateway,
      gateway_ref:     data.gatewayRef,
      amount_paise:    data.amountPaise,
      currency:        data.currency,
      period_start:    data.periodStart ?? null,
      period_end:      data.periodEnd   ?? null,
      status:          "paid",
      issued_at:       new Date().toISOString(),
    })
    .select("id, invoice_number")
    .single();

  if (error) {
    console.error("[createInvoice]", error.message);
    return null;
  }

  return { id: invoice.id, invoiceNumber: invoice.invoice_number };
}

/**
 * Format smallest-currency-unit amount as human-readable string.
 * Works for all currencies: INR (paise), USD (cents), EUR (eurocents), GBP (pence), etc.
 * Returns "—" when amount is 0 (e.g., Apple IAP where amount is unavailable server-side).
 */
export function formatAmount(smallestUnit: number, currency = "INR"): string {
  if (smallestUnit === 0) return "—";
  const amount = smallestUnit / 100;
  try {
    return new Intl.NumberFormat("en", {
      style: "currency", currency,
      minimumFractionDigits: 2, maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

/** Generate HTML invoice for a given invoice row. */
export function renderInvoiceHtml(invoice: {
  invoice_number: string;
  description:    string;
  amount_paise:   number;
  currency:       string;
  payment_gateway: string;
  gateway_ref:    string;
  issued_at:      string;
  period_start?:  string | null;
  period_end?:    string | null;
  status:         string;
  user_email:     string;
  user_name?:     string | null;
}): string {
  const issuedDate = new Date(invoice.issued_at).toLocaleDateString("en-IN", {
    day: "numeric", month: "long", year: "numeric",
  });
  const amount = formatAmount(invoice.amount_paise, invoice.currency);
  const periodText = invoice.period_start && invoice.period_end
    ? `${new Date(invoice.period_start).toLocaleDateString("en-IN", { day:"numeric", month:"short", year:"numeric" })} — ${new Date(invoice.period_end).toLocaleDateString("en-IN", { day:"numeric", month:"short", year:"numeric" })}`
    : null;

  const gatewayLabel = {
    razorpay:    "Razorpay",
    apple:       "Apple App Store",
    google_play: "Google Play Store",
    stripe:      "Stripe",
  }[invoice.payment_gateway] ?? invoice.payment_gateway;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Invoice ${invoice.invoice_number} — Imotara</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#111827;background:#f9fafb;padding:32px}
  .page{background:#fff;max-width:640px;margin:auto;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)}
  .header{background:linear-gradient(135deg,#4f46e5,#0ea5e9);padding:32px 40px;color:#fff}
  .logo{font-size:22px;font-weight:700;letter-spacing:-0.5px}
  .logo span{opacity:0.7}
  .invoice-tag{margin-top:4px;font-size:12px;opacity:0.8;letter-spacing:0.05em}
  .body{padding:40px}
  .row{display:flex;justify-content:space-between;margin-bottom:12px;font-size:14px}
  .label{color:#6b7280}
  .value{font-weight:500}
  .divider{border:none;border-top:1px solid #e5e7eb;margin:24px 0}
  .amount-row{display:flex;justify-content:space-between;align-items:center;background:#f5f3ff;border-radius:8px;padding:16px 20px}
  .amount-label{font-size:14px;color:#4f46e5;font-weight:600}
  .amount-value{font-size:24px;font-weight:700;color:#312e81}
  .status{display:inline-block;padding:3px 10px;border-radius:999px;font-size:11px;font-weight:600;letter-spacing:0.05em;text-transform:uppercase}
  .status-paid{background:#d1fae5;color:#065f46}
  .status-refunded{background:#fee2e2;color:#991b1b}
  .footer{background:#f9fafb;padding:20px 40px;font-size:12px;color:#9ca3af;text-align:center}
  @media print{body{background:#fff;padding:0}.page{box-shadow:none;border-radius:0}}
</style>
</head>
<body>
<div class="page">
  <div class="header">
    <div class="logo">imotara<span>.</span></div>
    <div class="invoice-tag">Payment Receipt</div>
  </div>
  <div class="body">
    <div class="row"><span class="label">Invoice number</span><span class="value">${invoice.invoice_number}</span></div>
    <div class="row"><span class="label">Issued</span><span class="value">${issuedDate}</span></div>
    <div class="row"><span class="label">Billed to</span><span class="value">${invoice.user_name ? `${invoice.user_name} ` : ""}${invoice.user_email}</span></div>
    <div class="row"><span class="label">Status</span><span class="status ${invoice.status === "paid" ? "status-paid" : "status-refunded"}">${invoice.status}</span></div>
    <hr class="divider"/>
    <div class="row"><span class="label">Description</span><span class="value">${invoice.description}</span></div>
    ${periodText ? `<div class="row"><span class="label">Period</span><span class="value">${periodText}</span></div>` : ""}
    <div class="row"><span class="label">Payment via</span><span class="value">${gatewayLabel}</span></div>
    <div class="row"><span class="label">Reference</span><span class="value" style="font-family:monospace;font-size:12px">${invoice.gateway_ref}</span></div>
    <hr class="divider"/>
    <div class="amount-row">
      <span class="amount-label">Total paid</span>
      <span class="amount-value">${amount}</span>
    </div>
  </div>
  <div class="footer">
    Imotara · 6/B, Kalipada Mukherjee Road, Kolkata, West Bengal – 700008, India · info@imotara.com<br/>
    This is a computer-generated receipt and does not require a signature.
  </div>
</div>
</body>
</html>`;
}
