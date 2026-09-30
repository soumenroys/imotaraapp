// src/app/api/license/status/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCurrentLicenseStatus } from "@/lib/imotara/license";
import { supabaseUserServer } from "@/lib/supabase/userServer";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { resolveUserTier } from "@/lib/imotara/org";
import { normaliseTier } from "@/types/license";
import { isClientStale, minSupportedVersion } from "@/lib/imotara/clientVersion";

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
        const tierResult = await resolveUserTier(userId);

        // 🔴 DO NOT REPORT `free` WHEN WE SIMPLY COULD NOT FIND OUT.
        //
        // This block used to fall through to `fallback.tier` (= "free") whenever
        // resolveUserTier() failed, returning HTTP 200 with `ok: true` and no
        // hint that anything had gone wrong. A comment above it called that
        // "fail-open". It is the opposite: from the user's side, being told they
        // are on Free is fail-CLOSED — they lose what they paid for. Under
        // LICENSE_MODE=enforce a single database hiccup would downgrade a
        // paying subscriber, silently, with no error anywhere.
        //
        // 🔑 Every client already handles a non-OK response correctly, by
        // KEEPING what it last knew rather than downgrading:
        //   - mobile  `SettingsContext.tsx`: `if (!statusRes.ok) return;`
        //   - web     `useLicense.ts`: throws, catch preserves the previous tier
        //   - web     `settings/page.tsx`: catch shows an error, not "Free"
        // So telling the truth here is both safer and requires no client change.
        //
        // ⚠️ Only reached when the user IS identified. An anonymous caller is
        // handled above and legitimately gets the free fallback.
        if (!tierResult.ok) {
            const res = NextResponse.json(
                {
                    ok: false,
                    error: "tier_unresolved",
                    detail: tierResult.error,
                    mode: fallback.mode,
                    user: { id: userId, email: userEmail },
                },
                { status: 503 },
            );
            res.headers.set("Cache-Control", "no-store");
            return res;
        }

        let effectiveTier:   string = fallback.tier;
        let effectiveStatus: string = "valid";
        let effectiveExpiry: string | null = null;
        let effectiveTokens: number = 0;
        let orgContext: { orgId: string; orgName: string; orgRole: string; billingType: string | null } | null = null;

        if (tierResult.ok) {
            const t = tierResult.data;
            // Enforce expiry client-side as an extra safety check
            const isExpired = t.expiresAt != null && new Date(t.expiresAt).getTime() < Date.now();
            // normaliseTier so a legacy `pro` row (or the mobile spelling)
            // reaches every client as the canonical `plus`. This endpoint is
            // what BOTH the web app and the mobile app read and cache, so it is
            // the single place that decides what a user sees their plan called.
            effectiveTier   = isExpired ? "free" : normaliseTier(t.effectiveTier);
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
                // Advisory only, and absent unless IMOTARA_MIN_SUPPORTED_APP_VERSION
                // is deliberately set. 1.4.4+ clients use it to steer users to
                // an update before showing prices they cannot render correctly.
                // Older clients simply ignore an unknown field — which is why
                // this is additive rather than a new endpoint or a 4xx.
                ...(minSupportedVersion()
                    ? { client: { minSupportedVersion: minSupportedVersion(), updateRequired: isClientStale(req) } }
                    : {}),
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
