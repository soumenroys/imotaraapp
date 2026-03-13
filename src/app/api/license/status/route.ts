// src/app/api/license/status/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCurrentLicenseStatus } from "@/lib/imotara/license";
import { supabaseUserServer } from "@/lib/supabase/userServer";

const IS_PROD = process.env.NODE_ENV === "production";

export async function GET() {
    const fallback = getCurrentLicenseStatus();

    // Next 16+: cookies() is async in some runtimes/types, so await it.
    const cookieStore = await cookies();

    // Debug info: only collected in non-production
    const testCookie = IS_PROD ? null : (cookieStore.get("imotara_test")?.value ?? null);
    const cookieNames = IS_PROD ? [] : cookieStore.getAll().map((c) => c.name);
    const hasSupabaseCookie = IS_PROD
        ? undefined
        : cookieNames.some(
              (n) => n.startsWith("sb-") || n.includes("supabase") || n.includes("auth")
          );

    try {
        const supabase = await supabaseUserServer();

        const { data: authData, error: authErr } = await supabase.auth.getUser();

        const debugPayload = IS_PROD
            ? undefined
            : { received_imotara_test: testCookie, cookie_names: cookieNames, has_supabase_cookie: hasSupabaseCookie };

        // If no user, return fallback (still ok:true)
        if (authErr || !authData?.user) {
            const res = NextResponse.json(
                { ok: true, mode: fallback.mode, license: { ...fallback, source: "internal", expiresAt: null }, user: null, ...(debugPayload ? { debug: debugPayload } : {}) },
                { status: 200 }
            );
            res.headers.set("Cache-Control", "no-store");
            return res;
        }

        const userId = authData.user.id;

        // OPTIONAL: try to read license row if table exists.
        // If table doesn't exist yet, we silently fall back.
        let licenseRow: null | {
            tier?: string | null;
            status?: string | null;
            expires_at?: string | null;
        } = null;

        const { data: row, error: licErr } = await supabase
            .from("licenses")
            .select("tier,status,expires_at")
            .eq("user_id", userId)
            .maybeSingle();

        if (!licErr && row) licenseRow = row;

        const res = NextResponse.json(
            {
                ok: true,
                mode: fallback.mode,
                license: {
                    status: (licenseRow?.status as "valid" | "invalid" | "expired") ?? "valid",
                    tier: (licenseRow?.tier as "free" | "pro") ?? fallback.tier,
                    mode: fallback.mode,
                    source: licenseRow ? "supabase" : "internal",
                    expiresAt: licenseRow?.expires_at ?? null,
                },
                user: { id: userId, email: authData.user.email ?? null },
                ...(debugPayload ? { debug: debugPayload } : {}),
            },
            { status: 200 }
        );

        res.headers.set("Cache-Control", "no-store");
        return res;
    } catch {
        // Fail-open
        const debugPayload = IS_PROD
            ? undefined
            : { received_imotara_test: testCookie, cookie_names: cookieNames, has_supabase_cookie: hasSupabaseCookie };
        const res = NextResponse.json(
            { ok: true, mode: fallback.mode, license: { ...fallback, source: "internal", expiresAt: null }, user: null, ...(debugPayload ? { debug: debugPayload } : {}) },
            { status: 200 }
        );
        res.headers.set("Cache-Control", "no-store");
        return res;
    }
}
