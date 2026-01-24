// src/app/api/health/route.ts
import { NextResponse } from "next/server";

export async function GET() {
    // ✅ Do NOT leak secrets; only report presence + non-sensitive flags.
    const present = (v?: string | null) => !!(v && String(v).trim().length > 0);

    const env = {
        // Razorpay (donations)
        RAZORPAY_KEY_ID: present(process.env.RAZORPAY_KEY_ID),
        RAZORPAY_KEY_SECRET: present(process.env.RAZORPAY_KEY_SECRET),
        RAZORPAY_WEBHOOK_SECRET: present(process.env.RAZORPAY_WEBHOOK_SECRET),

        // Supabase (donation receipts storage)
        SUPABASE_URL: present(process.env.SUPABASE_URL),
        SUPABASE_ANON_KEY: present(process.env.SUPABASE_ANON_KEY),
        SUPABASE_SERVICE_ROLE_KEY: present(process.env.SUPABASE_SERVICE_ROLE_KEY),

        // App
        NODE_ENV: process.env.NODE_ENV || "unknown",
    };

    const ok =
        env.RAZORPAY_KEY_ID &&
        env.RAZORPAY_KEY_SECRET &&
        env.RAZORPAY_WEBHOOK_SECRET &&
        env.SUPABASE_URL &&
        (env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY);

    return NextResponse.json(
        {
            ok,
            env,
            note: "This endpoint reports only whether required env vars are present. It never returns secret values.",
        },
        { status: ok ? 200 : 500 }
    );
}
