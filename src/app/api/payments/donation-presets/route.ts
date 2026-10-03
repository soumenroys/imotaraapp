// GET /api/payments/donation-presets
//
// 🔴 WHY THIS EXISTS. /donate is a client component, so it cannot read the
// edge geo header itself. Without this it would render one hardcoded rupee
// ladder to everyone while the server charged a banded amount — the display
// and the charge would disagree, which is worse than not banding at all.
//
// 🔑 This endpoint is ADVISORY. The amount actually charged is decided again,
// server-side, in donation-intent from the same (band, tier) functions. If this
// response were stale, tampered with, or cached wrongly, the charge is still
// correct — the user would just have seen a different number first.
import { NextResponse } from "next/server";
import { bandForCountry, donationPresetsForBand } from "@/lib/imotara/pricingBands";

// ⚠️ Must never be statically cached: the whole answer depends on the caller's
// edge location. A cached response would serve one country's prices to all.
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
    const country = req.headers.get("x-vercel-ip-country");
    const band = bandForCountry(country);
    return NextResponse.json(
        { ok: true, band, currency: "INR", presets: donationPresetsForBand(band) },
        { headers: { "Cache-Control": "private, no-store" } },
    );
}
