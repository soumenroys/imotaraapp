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
// 🔑 Apple too (6 Nov 2026): a renewal there gets a NEW transaction id the app
// sends only when the upgrade sheet restores purchases ⇒ sweepAppleRenewals.

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { markCronFired } from "@/lib/cron/heartbeat";
import { verifyGooglePlaySubscription } from "@/lib/googlePlay";
import { sweepPlayRenewals, sweepAppleRenewals } from "@/lib/imotara/playRenewal";
import { appleSubscriptionExpiry } from "@/lib/apple/storeServer";

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
  const hasApple = !!(process.env.APPLE_IAP_ISSUER_ID && process.env.APPLE_IAP_KEY_ID && process.env.APPLE_IAP_PRIVATE_KEY);
  const apple = hasApple
    ? await sweepAppleRenewals(getSupabaseAdmin(), { expiry: (id) => appleSubscriptionExpiry(id) })
    : { checked: 0, extended: 0, errors: ["Apple IAP credentials not configured"] };
  const errors = [...out.errors, ...apple.errors];
  if (errors.length) console.error("[store-renewals]", errors.slice(0, 5));
  return NextResponse.json({
    ok: errors.length === 0,
    play: { checked: out.checked, extended: out.extended },
    apple: { checked: apple.checked, extended: apple.extended },
    errors: errors.length,
  });
}
