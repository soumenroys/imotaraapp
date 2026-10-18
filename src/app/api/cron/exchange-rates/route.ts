export const preferredRegion = ["sin1"];
export const maxDuration = 30;

// GET /api/cron/exchange-rates
// Fetches latest USD-base exchange rates and stores them in app_settings.
// Call from Vercel Cron or any scheduler — protected by CRON_SECRET header.
// Rates are stored as { USD, EUR, GBP, AED, SGD, AUD } all relative to INR.

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { markCronFired } from "@/lib/cron/heartbeat";

const CRON_SECRET   = process.env.CRON_SECRET ?? "";
const EXCHANGE_API  = "https://open.exchangerate-api.com/v6/latest/INR";

// Hardcoded fallback in case the API is unreachable
const FALLBACK: Record<string, number> = {
  USD: 83.5, EUR: 90.2, GBP: 105.8, AED: 22.7, SGD: 61.9, AUD: 54.3,
};

export async function GET(req: NextRequest) {
  // 🔴 THE BEARER HEADER IS THE ONE VERCEL CRON ACTUALLY SENDS, and until
  // 2026-10-13 this route did not accept it. It checked only `x-cron-secret`
  // or `?secret=`, neither of which Vercel sends, so every scheduled run
  // answered 401 and the job NEVER SUCCEEDED ONCE.
  //
  // ⚠️ Proven, not inferred: app_settings.exchange_rates still held the SEED
  // PLACEHOLDER from docs/sql/connect_schema.sql byte-for-byte, with
  // updated_at = 2026-06-05, the day the schema was applied. Not stale data —
  // no data. ⇒ international prices were converted at hardcoded guesses.
  //
  // The two older forms are kept so a manual curl from a runbook still works.
  const bearer = req.headers.get("authorization") ?? "";
  const secret =
    (bearer.startsWith("Bearer ") ? bearer.slice(7) : "") ||
    req.headers.get("x-cron-secret") ||
    req.nextUrl.searchParams.get("secret") ||
    "";
  if (!CRON_SECRET || secret !== CRON_SECRET) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  // 🔵 It fired. Recorded before the work, so a job that crashes
  // half-way still proves Vercel invoked it. Never throws.
  void markCronFired("/api/cron/exchange-rates");

  let rates: Record<string, number>;

  try {
    const res = await fetch(EXCHANGE_API, { next: { revalidate: 0 } });
    if (!res.ok) throw new Error(`API ${res.status}`);
    const data = await res.json();
    // API returns rates as { INR_per_1_INR: 1, USD_per_1_INR: 0.012, ... }
    // We want INR cost to buy 1 unit of each foreign currency = 1 / rate
    const raw: Record<string, number> = data.rates ?? {};
    rates = {
      USD: raw.USD ? Math.round((1 / raw.USD) * 100) / 100 : FALLBACK.USD,
      EUR: raw.EUR ? Math.round((1 / raw.EUR) * 100) / 100 : FALLBACK.EUR,
      GBP: raw.GBP ? Math.round((1 / raw.GBP) * 100) / 100 : FALLBACK.GBP,
      AED: raw.AED ? Math.round((1 / raw.AED) * 100) / 100 : FALLBACK.AED,
      SGD: raw.SGD ? Math.round((1 / raw.SGD) * 100) / 100 : FALLBACK.SGD,
      AUD: raw.AUD ? Math.round((1 / raw.AUD) * 100) / 100 : FALLBACK.AUD,
    };
  } catch {
    rates = FALLBACK;
  }

  const supabase = getSupabaseAdmin();

  const { error } = await supabase
    .from("app_settings")
    .upsert({ key: "exchange_rates", value: rates, updated_at: new Date().toISOString() }, { onConflict: "key" });

  if (error) {
    console.error("[exchange-rates] DB upsert error:", error.message);
    return NextResponse.json({ ok: false, error: "Internal error", rates }, { status: 500 });
  }

  // ── Usage-geography retention, piggy-backed on the only daily cron ────────
  // Sums usage_geo_daily rows older than 100 days into one row per month,
  // destroying the exact date. The trend survives; the one thing that could
  // ever come close to singling someone out — a small count on a specific
  // DAY in a specific region — does not.
  //
  // ⛔ Here rather than in an eighth Vercel cron: the cron count is pinned by
  // everyCronAnswersTheVerbVercelSends.test.ts, and a once-a-day job does not
  // need a schedule of its own.
  // ⚠️ Its failure must never fail the exchange-rate update, which is what
  // this route is actually for and what session billing depends on.
  let rolledUp: number | null = null;
  try {
    const { data } = await supabase.rpc("imotara_roll_up_usage_geo");
    rolledUp = typeof data === "number" ? data : null;
  } catch {
    // Migration not run in this environment, or a transient error. Rates still
    // updated; the roll-up simply runs tomorrow instead.
  }

  return NextResponse.json({ ok: true, rates, rolledUp, updated_at: new Date().toISOString() });
}
