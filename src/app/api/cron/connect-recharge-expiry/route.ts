// GET /api/cron/connect-recharge-expiry
// Called by Vercel Cron every 30 minutes.
// Marks abandoned connect_recharges rows as "failed" when they have been pending
// for more than 30 minutes. Razorpay auto-expires orders after 15 minutes; if the
// payment.failed webhook is not delivered, the row stays "pending" indefinitely and
// the uq_connect_recharges_user_consultant_pending unique index blocks all future
// recharges for that user+consultant pair until the stale row is cleaned up.

export const preferredRegion = ["sin1"];

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";

const CRON_SECRET = process.env.CRON_SECRET ?? "";
// 30 min = 2× Razorpay's 15-min order lifetime — enough margin to let legitimate
// slow-network verifications complete before we expire the row.
const EXPIRY_MINUTES = 30;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  const cutoff = new Date(Date.now() - EXPIRY_MINUTES * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("connect_recharges")
    .update({ status: "failed" })
    .eq("status", "pending")
    .lt("created_at", cutoff)
    .select("id");

  if (error) {
    console.error("[cron/connect-recharge-expiry] update failed:", error.message);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const expired = (data ?? []).length;
  if (expired > 0) {
    console.log(`[cron/connect-recharge-expiry] expired ${expired} stale pending recharge(s)`);
  }

  return NextResponse.json({ ok: true, expired });
}
