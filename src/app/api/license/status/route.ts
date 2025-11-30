// src/app/api/license/status/route.ts
import { NextResponse } from "next/server";
import { getCurrentLicenseStatus } from "@/lib/imotara/license";

/**
 * Lightweight license status endpoint.
 *
 * For now, this:
 *   - ALWAYS returns a "valid", "pro" license
 *   - Exposes the current mode ("off" | "log" | "enforce")
 *
 * ❗ It does NOT enforce or block anything.
 *    Existing app behavior is unchanged.
 */
export async function GET() {
    const status = getCurrentLicenseStatus();

    return NextResponse.json(
        {
            ok: true,
            license: status,
        },
        { status: 200 }
    );
}
