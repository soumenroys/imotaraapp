// src/app/api/license/status/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCurrentLicenseStatus } from "@/lib/imotara/license";
import { supabaseUserServer } from "@/lib/supabase/userServer";
import { getSupabaseAdmin } from "@/lib/supabaseServer";

const IS_PROD = process.env.NODE_ENV === "production";

export async function GET(req: Request) {
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
        // Accept Bearer token (mobile) OR cookie (web)
        let userId: string | null = null;
        let userEmail: string | null = null;
        const bearerToken = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();

        if (bearerToken) {
            const { data } = await getSupabaseAdmin().auth.getUser(bearerToken);
            userId = data?.user?.id ?? null;
            userEmail = data?.user?.email ?? null;
        }

        if (!userId) {
            const supabase = await supabaseUserServer();
            const { data: authData, error: authErr } = await supabase.auth.getUser();
            if (!authErr && authData?.user) {
                userId = authData.user.id;
                userEmail = authData.user.email ?? null;
            }
        }

        const debugPayload = IS_PROD
            ? undefined
            : { received_imotara_test: testCookie, cookie_names: cookieNames, has_supabase_cookie: hasSupabaseCookie };

        // If no user, return fallback (still ok:true)
        if (!userId) {
            const res = NextResponse.json(
                { ok: true, mode: fallback.mode, license: { ...fallback, source: "internal", expiresAt: null }, user: null, ...(debugPayload ? { debug: debugPayload } : {}) },
                { status: 200 }
            );
            res.headers.set("Cache-Control", "no-store");
            return res;
        }

        // OPTIONAL: try to read license row if table exists.
        // If table doesn't exist yet, we silently fall back.
        let licenseRow: null | {
            tier?: string | null;
            status?: string | null;
            expires_at?: string | null;
        } = null;

        const adminClient = getSupabaseAdmin();
        const { data: row, error: licErr } = await adminClient
            .from("licenses")
            .select("tier,status,expires_at")
            .eq("user_id", userId)
            .maybeSingle();

        if (!licErr && row) licenseRow = row;

        // Enforce expiry: treat as free if expires_at is set and in the past
        const isExpired =
            licenseRow?.expires_at != null &&
            new Date(licenseRow.expires_at).getTime() < Date.now();
        const effectiveTier = isExpired
            ? "free"
            : ((licenseRow?.tier as import("@/types/license").LicenseTier) ?? fallback.tier);
        const effectiveStatus = isExpired ? "expired" : ((licenseRow?.status as "valid" | "invalid" | "expired") ?? "valid");

        const res = NextResponse.json(
            {
                ok: true,
                mode: fallback.mode,
                license: {
                    status: effectiveStatus,
                    tier: effectiveTier,
                    mode: fallback.mode,
                    source: licenseRow ? "supabase" : "internal",
                    expiresAt: licenseRow?.expires_at ?? null,
                },
                user: { id: userId, email: userEmail ?? null },
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
