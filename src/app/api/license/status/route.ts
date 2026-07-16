// src/app/api/license/status/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCurrentLicenseStatus } from "@/lib/imotara/license";
import { supabaseUserServer } from "@/lib/supabase/userServer";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { resolveUserTier } from "@/lib/imotara/org";

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

        // Resolve effective tier — handles org license, personal license, and expiry.
        // Falls back to free if the DB call fails (fail-open).
        const tierResult = await resolveUserTier(userId);

        let effectiveTier:   string = fallback.tier;
        let effectiveStatus: string = "valid";
        let effectiveExpiry: string | null = null;
        let effectiveTokens: number = 0;
        let orgContext: { orgId: string; orgName: string; orgRole: string; billingType: string | null } | null = null;

        if (tierResult.ok) {
            const t = tierResult.data;
            // Enforce expiry client-side as an extra safety check
            const isExpired = t.expiresAt != null && new Date(t.expiresAt).getTime() < Date.now();
            effectiveTier   = isExpired ? "free" : (t.effectiveTier as import("@/types/license").LicenseTier);
            effectiveStatus = isExpired ? "expired" : t.status;
            effectiveExpiry = isExpired ? null : (t.expiresAt ?? null);
            effectiveTokens = t.tokenBalance;

            if (t.orgId) {
                orgContext = { orgId: t.orgId, orgName: t.orgName ?? "", orgRole: t.orgRole ?? "member", billingType: t.orgBillingType ?? null };
            }
        }

        const res = NextResponse.json(
            {
                ok: true,
                mode: fallback.mode,
                license: {
                    status:       effectiveStatus,
                    tier:         effectiveTier,
                    mode:         fallback.mode,
                    source:       tierResult.ok ? tierResult.data.tierSource : "internal",
                    expiresAt:    effectiveExpiry,
                    tokenBalance: effectiveTokens,
                },
                // org is null for personal/free users; populated for org members
                org:  orgContext,
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
