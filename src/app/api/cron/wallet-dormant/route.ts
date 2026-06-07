// GET /api/cron/wallet-dormant
// Vercel Cron — runs daily at 09:00 IST (03:30 UTC).
//
// Marks wallets that have been inactive for 2+ years as 'dormant'.
// IMPORTANT: Balance is NEVER zeroed. The full amount is preserved and refundable
// for 1 year after dormancy (by user request via support or the in-app form).
//
// Legal basis: Consumer Protection Act 2019 (India). Imotara's closed-loop wallet
// is exempt from RBI PPI regulations but must honour consumer protection rights.
// Keeping the balance intact eliminates any forfeiture risk.

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { sendWalletNotification } from "@/lib/wallet/mailer";

const CRON_SECRET = process.env.CRON_SECRET ?? "";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  const now      = new Date();

  // Find active wallets with a positive balance whose 2-year window has passed
  // AND whose dormancy notice hasn't been sent yet.
  const { data: wallets, error } = await supabase
    .from("imotara_wallets")
    .select("user_id, balance, currency_code, expires_at, notified_dormant_at")
    .eq("status", "active")
    .gt("balance", 0)
    .lt("expires_at", now.toISOString())
    .is("notified_dormant_at", null);

  if (error) {
    console.error("[wallet-dormant] query error:", error.message);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  if (!wallets || wallets.length === 0) {
    return NextResponse.json({ ok: true, marked_dormant: 0 });
  }

  let marked = 0;
  for (const wallet of wallets) {
    // Mark as dormant — balance is fully preserved, refundable for 1 year.
    await supabase.from("imotara_wallets").update({
      status:              "dormant",
      dormant_at:          now.toISOString(),
      notified_dormant_at: now.toISOString(),
    }).eq("user_id", wallet.user_id);

    // Log a non-destructive event in transaction history
    await supabase.from("imotara_wallet_transactions").insert({
      user_id:       wallet.user_id,
      type:          "dormancy_marked",
      amount:        Number(wallet.balance),
      currency_code: wallet.currency_code ?? "INR",
      description:   "Wallet marked dormant after 2 years of inactivity. Balance preserved — refundable for 1 year.",
    });

    // Fetch email and send dormancy notification
    const { data: { user } } = await supabase.auth.admin.getUserById(wallet.user_id);
    if (user?.email) {
      await sendWalletNotification({
        userId:    wallet.user_id,
        email:     user.email,
        type:      "dormant_notice",
        balance:   Number(wallet.balance),
        expiresAt: wallet.expires_at,
      });
    }

    console.log(`[wallet-dormant] marked dormant: user=${wallet.user_id} balance=₹${wallet.balance}`);
    marked++;
  }

  return NextResponse.json({ ok: true, marked_dormant: marked });
}
