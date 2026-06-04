// src/app/api/subscription/cancel/route.ts
// POST /api/subscription/cancel
// Marks subscription for cancellation at period end.
// For Razorpay: cancels subscription via Razorpay API if possible.
// For Apple IAP: directs user to Apple — we cannot cancel on their behalf.
// For Google Play: will direct to Play Store.
// Access is kept until period_end.

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin, getSupabaseUserServerClient } from "@/lib/supabaseServer";

export async function POST(req: NextRequest) {
  // Resolve user
  let userId: string | null = null;
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (bearer) {
    const { data } = await getSupabaseAdmin().auth.getUser(bearer);
    userId = data?.user?.id ?? null;
  }
  if (!userId) {
    const supabase = await getSupabaseUserServerClient();
    const { data } = await supabase.auth.getUser();
    userId = data?.user?.id ?? null;
  }
  if (!userId) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const admin = getSupabaseAdmin();

  const { data: license } = await admin
    .from("licenses")
    .select("tier, status, expires_at, source, external_ref")
    .eq("user_id", userId)
    .single();

  if (!license || license.tier === "free") {
    return NextResponse.json({ error: "No active subscription to cancel." }, { status: 400 });
  }

  // For Razorpay subscriptions — try API cancel
  if (license.source === "razorpay" && license.external_ref) {
    try {
      const razorpayKey    = process.env.RAZORPAY_KEY_ID?.trim();
      const razorpaySecret = process.env.RAZORPAY_KEY_SECRET?.trim();
      if (razorpayKey && razorpaySecret) {
        const auth = Buffer.from(`${razorpayKey}:${razorpaySecret}`).toString("base64");
        const cancelRes = await fetch(
          `https://api.razorpay.com/v1/subscriptions/${license.external_ref}/cancel`,
          {
            method: "POST",
            headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
            body: JSON.stringify({ cancel_at_cycle_end: 1 }), // cancel at period end, not immediately
          }
        );
        if (!cancelRes.ok) {
          console.warn("[subscription/cancel] Razorpay cancel failed:", await cancelRes.text());
        }
      }
    } catch (err) {
      console.error("[subscription/cancel] Razorpay error:", err);
    }
  }

  // Mark license as cancelling (status update)
  // Keep access until expires_at — don't revoke tier immediately
  await admin.from("licenses").update({
    status:     "cancelling",
    updated_at: new Date().toISOString(),
  }).eq("user_id", userId);

  return NextResponse.json({
    ok:      true,
    message: `Your ${license.tier} subscription will remain active until ${license.expires_at ? new Date(license.expires_at).toLocaleDateString("en-IN", { day:"numeric", month:"long", year:"numeric" }) : "the end of your billing period"}, then revert to Free.`,
    source:  license.source,
  });
}
