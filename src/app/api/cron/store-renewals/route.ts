// src/app/api/cron/store-renewals/route.ts
// GET /api/cron/store-renewals — daily.
//
// Asks Google about every Play subscription we have granted and extends the
// ones still active to Google's own expiry ⇒ lib/imotara/playRenewal.ts.
//
// 🔴 Why a sweep and not Google's push: Real-time developer notifications are
// OFF in Play Console (seen 6 Nov 2026) and need a Pub/Sub topic. A daily
// question needs nothing new, and catches a missed push too.
//
// ⚠️ Apple is NOT covered here yet: a renewal there gets a NEW transaction id,
// which the app sends only when the upgrade sheet restores purchases.

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { markCronFired } from "@/lib/cron/heartbeat";
import { verifyGooglePlaySubscription } from "@/lib/googlePlay";
import { sweepPlayRenewals } from "@/lib/imotara/playRenewal";

export const maxDuration = 60;

const PACKAGE_NAME = process.env.GOOGLE_PLAY_PACKAGE_NAME ?? "com.imotara.imotara";

export async function GET(req: NextRequest) {
  const CRON_SECRET = process.env.CRON_SECRET ?? "";
  const bearer = req.headers.get("authorization") ?? "";
  const secret = (bearer.startsWith("Bearer ") ? bearer.slice(7) : "") || req.headers.get("x-cron-secret") || "";
  if (!CRON_SECRET || secret !== CRON_SECRET) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  void markCronFired("/api/cron/store-renewals");

  const out = await sweepPlayRenewals(getSupabaseAdmin(), {
    verify: (productId, token) => verifyGooglePlaySubscription(PACKAGE_NAME, productId, token),
  });
  if (out.errors.length) console.error("[store-renewals]", out.errors.slice(0, 5));
  return NextResponse.json({ ok: out.errors.length === 0, ...out, errors: out.errors.length });
}
