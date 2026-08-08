// POST /api/connect/wallet/topup/verify
// Retired 2026-08-08. The Imotara Wallet top-up UI was removed 2026-07-26, but this
// route (and topup/create) remained callable directly — one real user's client still
// completed an order through it after that date. Hard-blocked here so nothing can
// complete an order through this path again. See web_wallet_leak_and_kb_drift_2026_08_08
// in memory. To pay for a Connect session, use the per-companion recharge flow
// (POST /api/connect/wallet/recharge/create) instead — that is the only system that
// ever actually paid for a session.

export const preferredRegion = ["sin1"];

import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { ok: false, error: "Wallet top-up is no longer available. To pay for a Connect session, recharge minutes directly from a companion's profile." },
    { status: 410 }
  );
}
