// GET /api/cron/exchange-rates
// Fetches latest USD-base exchange rates and stores them in app_settings.
// Call from Vercel Cron or any scheduler — protected by CRON_SECRET header.
// Rates are stored as { USD, EUR, GBP, AED, SGD, AUD } all relative to INR.

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";

const CRON_SECRET   = process.env.CRON_SECRET ?? "";
const EXCHANGE_API  = "https://open.exchangerate-api.com/v6/latest/INR";

// Hardcoded fallback in case the API is unreachable
const FALLBACK: Record<string, number> = {
  USD: 83.5, EUR: 90.2, GBP: 105.8, AED: 22.7, SGD: 61.9, AUD: 54.3,
};

export async function GET(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret") ?? req.nextUrl.searchParams.get("secret") ?? "";
  if (!CRON_SECRET || secret !== CRON_SECRET) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

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
    return NextResponse.json({ ok: false, error: error.message, rates }, { status: 500 });
  }

  return NextResponse.json({ ok: true, rates, updated_at: new Date().toISOString() });
}
