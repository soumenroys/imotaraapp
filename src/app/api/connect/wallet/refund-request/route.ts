export const preferredRegion = ["sin1"];

// POST /api/connect/wallet/refund-request
// Auth required. Submits a wallet refund request for a dormant balance.
// Body: { bank_name?, account_number?, ifsc_code?, account_holder?, upi_id?, reason? }
// Either bank details OR upi_id must be provided.

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { getConnectUser } from "@/lib/connect/auth";
import nodemailer from "nodemailer";

const SMTP_HOST  = process.env.SMTP_HOST               ?? "smtp.hostinger.com";
const GMAIL_USER = process.env.ALERT_GMAIL_USER         ?? "";
const GMAIL_PASS = process.env.ALERT_GMAIL_APP_PASSWORD ?? "";
const SUPPORT    = "support@imotara.com";
const TERMS_URL  = "https://imotara.com/connect/wallet-terms";

function genRef(): string {
  return `IMW-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

export async function POST(req: NextRequest) {
  const user = await getConnectUser(req);
  if (!user) {
    return NextResponse.json({ ok: false, error: "Authentication required" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ ok: false, error: "Invalid body" }, { status: 400 });

  const supabase = getSupabaseAdmin();

  // Fetch wallet — must exist and be dormant (or active with balance)
  const { data: wallet } = await supabase
    .from("imotara_wallets")
    .select("balance, currency_code, status, dormant_at")
    .eq("user_id", user.id)
    .single();

  if (!wallet || Number(wallet.balance) <= 0) {
    return NextResponse.json({ ok: false, error: "No balance available for refund" }, { status: 400 });
  }
  if (wallet.status === "refund_requested") {
    return NextResponse.json({ ok: false, error: "A refund request is already in progress. Please wait for it to be processed." }, { status: 400 });
  }

  // Check 1-year grace period for dormant wallets
  if (wallet.status === "dormant" && wallet.dormant_at) {
    const gracePeriodEnd = new Date(new Date(wallet.dormant_at).getTime() + 365 * 86_400_000);
    if (new Date() > gracePeriodEnd) {
      return NextResponse.json(
        { ok: false, error: "The 1-year grace period for this dormant balance has ended. Please contact support@imotara.com." },
        { status: 400 }
      );
    }
  }

  // Validate payment details
  const { bank_name, account_number, ifsc_code, account_holder, upi_id, reason } = body;
  const hasBankDetails = account_number && ifsc_code && account_holder;
  const hasUpi         = !!upi_id;

  // Length guards to prevent bloated DB rows and email abuse
  if (typeof bank_name === "string"      && bank_name.length > 100)      return NextResponse.json({ ok: false, error: "bank_name too long" }, { status: 400 });
  if (typeof account_number === "string" && account_number.length > 30)  return NextResponse.json({ ok: false, error: "account_number too long" }, { status: 400 });
  if (typeof ifsc_code === "string"      && ifsc_code.length > 20)       return NextResponse.json({ ok: false, error: "ifsc_code too long" }, { status: 400 });
  if (typeof account_holder === "string" && account_holder.length > 100) return NextResponse.json({ ok: false, error: "account_holder too long" }, { status: 400 });
  if (typeof upi_id === "string"         && upi_id.length > 60)          return NextResponse.json({ ok: false, error: "upi_id too long" }, { status: 400 });
  if (typeof reason === "string"         && reason.length > 500)         return NextResponse.json({ ok: false, error: "reason too long (max 500 chars)" }, { status: 400 });

  if (!hasBankDetails && !hasUpi) {
    return NextResponse.json(
      { ok: false, error: "Provide bank account details (account number + IFSC + holder name) or a UPI ID" },
      { status: 400 }
    );
  }

  // Check for duplicate pending request
  const { data: existing } = await supabase
    .from("imotara_wallet_refund_requests")
    .select("id, status")
    .eq("user_id", user.id)
    .in("status", ["pending", "processing"])
    .limit(1)
    .single();

  if (existing) {
    return NextResponse.json(
      { ok: false, error: "You already have a pending refund request. Please wait for it to be processed." },
      { status: 400 }
    );
  }

  const ref     = genRef();
  const amount  = Number(wallet.balance);
  const now     = new Date().toISOString();

  // Insert refund request
  await supabase.from("imotara_wallet_refund_requests").insert({
    user_id:          user.id,
    amount,
    currency_code:    wallet.currency_code ?? "INR",
    bank_name:        bank_name ?? null,
    account_number:   account_number ?? null,
    ifsc_code:        ifsc_code ?? null,
    account_holder:   account_holder ?? null,
    upi_id:           upi_id ?? null,
    reason:           reason ?? null,
    status:           "pending",
    reference_number: ref,
  });

  // Update wallet status
  await supabase.from("imotara_wallets")
    .update({ status: "refund_requested" })
    .eq("user_id", user.id);

  // Send confirmation email to user
  const { data: { user: authUser } } = await supabase.auth.admin.getUserById(user.id);
  const email = authUser?.email;

  if (email && GMAIL_USER && GMAIL_PASS) {
    try {
      const transporter = nodemailer.createTransport({
        host: SMTP_HOST, port: 465, secure: true,
        auth: { user: GMAIL_USER, pass: GMAIL_PASS },
      });

      const paymentMethod = hasUpi
        ? `UPI ID: ${upi_id}`
        : `Bank: ${bank_name ?? "N/A"} | Account: ${account_number} | IFSC: ${ifsc_code} | Holder: ${account_holder}`;

      await transporter.sendMail({
        from:    `"Imotara" <${GMAIL_USER}>`,
        to:      email,
        subject: `Wallet Refund Request Received — Ref: ${ref}`,
        text: [
          `Dear Imotara user,`,
          ``,
          `We have received your wallet refund request. Here are the details:`,
          ``,
          `Reference Number: ${ref}`,
          `Refund Amount:    ₹${amount.toFixed(2)}`,
          `Payment Method:   ${paymentMethod}`,
          `Requested On:     ${new Date(now).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}`,
          ``,
          `WHAT HAPPENS NEXT:`,
          `Our team will verify your details and process the refund within 7 business days.`,
          `You will receive a confirmation email once the refund is processed.`,
          ``,
          `Please quote reference number ${ref} in any correspondence with us.`,
          ``,
          `If you have questions, email ${SUPPORT} with subject: "Wallet Refund — ${ref}"`,
          ``,
          `Wallet Policy: ${TERMS_URL}`,
          ``,
          `— The Imotara Team`,
        ].join("\n"),
      });

      // Alert support team
      await transporter.sendMail({
        from:    `"Imotara Wallet" <${GMAIL_USER}>`,
        to:      SUPPORT,
        subject: `[ACTION REQUIRED] Wallet Refund Request — ${ref} — ₹${amount.toFixed(2)}`,
        text: [
          `New wallet refund request received.`,
          ``,
          `Reference:      ${ref}`,
          `User ID:        ${user.id}`,
          `User Email:     ${email}`,
          `Amount:         ₹${amount.toFixed(2)}`,
          `Payment Method: ${paymentMethod}`,
          `Reason:         ${reason ?? "Not provided"}`,
          `Wallet Status:  ${wallet.status}`,
          `Dormant Since:  ${wallet.dormant_at ?? "N/A"}`,
          ``,
          `Process this refund within 7 business days and update status in:`,
          `Supabase → imotara_wallet_refund_requests → id=${ref}`,
        ].join("\n"),
      });
    } catch (err) {
      console.error("[wallet/refund-request] email error:", err);
    }
  }

  return NextResponse.json({ ok: true, reference_number: ref, amount });
}

// GET — fetch user's refund request status
export async function GET(req: NextRequest) {
  const user = await getConnectUser(req);
  if (!user) {
    return NextResponse.json({ ok: false, error: "Authentication required" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("imotara_wallet_refund_requests")
    .select("id, reference_number, amount, currency_code, status, requested_at, processed_at")
    .eq("user_id", user.id)
    .order("requested_at", { ascending: false })
    .limit(5);

  return NextResponse.json({ ok: true, requests: data ?? [] });
}
