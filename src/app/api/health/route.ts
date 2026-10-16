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

        // Supabase — NEXT_PUBLIC_ prefix for client-side vars
        SUPABASE_URL: present(process.env.NEXT_PUBLIC_SUPABASE_URL),
        SUPABASE_ANON_KEY: present(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
        SUPABASE_SERVICE_ROLE_KEY: present(process.env.SUPABASE_SERVICE_ROLE_KEY),

        // App
        NODE_ENV: process.env.NODE_ENV || "unknown",
    };

    // 🔑 FEATURE FLAGS — the VALUE, not just presence, because for a flag the
    // value is the whole point and none of it is secret.
    //
    // ⚠️ WHY THIS EXISTS. Setting a variable in Vercel does nothing until a
    // deploy picks it up, and there was no way to tell from outside which of
    // the two had happened. The standing rule on this project is that an
    // env-gated change is not shipped until it is confirmed live in
    // production; before this, confirming meant waiting for real traffic to
    // produce a side effect and then inferring backwards from the database.
    //
    // ⛔ Flags only. Never add anything whose value is a credential — the
    // block above deliberately reports secrets as a boolean and must stay
    // that way.
    const flags = {
        // Whether iOS/Android requests are counted in usage_geo_daily. Stays
        // off until the Play Data Safety form and Apple privacy label declare
        // IP-inferred approximate location ⇒ src/lib/analytics/usageGeo.ts.
        USAGE_GEO_MOBILE: process.env.IMOTARA_USAGE_GEO_MOBILE === "true",
        // Whether the retention job actually erases, or only reports.
        RETENTION_ENFORCE: process.env.IMOTARA_RETENTION_ENFORCE === "true",
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
            flags,
            note: "This endpoint reports only whether required env vars are present, plus the value of non-secret feature flags. It never returns secret values.",
        },
        { status: ok ? 200 : 500 }
    );
}
