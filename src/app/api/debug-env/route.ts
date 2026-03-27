// src/app/api/debug-env/route.ts
// TEMPORARY — remove after diagnosing donation env var issue
import { NextResponse } from "next/server";

export async function GET() {
    const raw = process.env.IMOTARA_DONATION_ENABLED;
    return NextResponse.json({
        IMOTARA_DONATION_ENABLED_raw: raw,
        IMOTARA_DONATION_ENABLED_type: typeof raw,
        IMOTARA_DONATION_ENABLED_lower: (raw || "").toLowerCase(),
        is_true: (raw || "").toLowerCase() === "true",
        RAZORPAY_KEY_ID_present: !!process.env.RAZORPAY_KEY_ID,
        RAZORPAY_KEY_SECRET_present: !!process.env.RAZORPAY_KEY_SECRET,
        NODE_ENV: process.env.NODE_ENV,
        timestamp: new Date().toISOString(),
    });
}
