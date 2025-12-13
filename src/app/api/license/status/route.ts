// src/app/api/license/status/route.ts
import { NextResponse } from "next/server";
import { getCurrentLicenseStatus } from "@/lib/imotara/license";

/**
 * Lightweight license status endpoint.
 *
 * For now, this:
 *   - Returns the current license status object
 *   - Exposes the current mode ("off" | "log" | "enforce")
 *
 * ❗ It does NOT enforce or block anything.
 *    Existing app behavior is unchanged.
 */
export async function GET() {
    const status = getCurrentLicenseStatus();

    const res = NextResponse.json(
        {
            ok: true,

            // ✅ Convenience: allow UI to read mode without drilling
            mode: status?.mode ?? process.env.NEXT_PUBLIC_IMOTARA_LICENSE_MODE ?? "off",

            // ✅ Backward-compatible payload (keep as-is)
            license: status,
        },
        { status: 200 }
    );

    // ✅ Always fresh (no caching)
    res.headers.set("Cache-Control", "no-store");

    return res;
}
