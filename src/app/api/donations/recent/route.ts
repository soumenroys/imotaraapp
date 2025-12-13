// src/app/api/donations/recent/route.ts
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

/**
 * Returns recent donation receipts for the current user.
 *
 * IMPORTANT (current phase):
 * - Web app does not yet have user auth wired end-to-end.
 * - So we do NOT guess user identity or leak global donation data.
 * - If user id is not provided, we safely return an empty list.
 *
 * Future:
 * - Replace the user-id lookup with real auth (NextAuth/Supabase auth),
 *   then this endpoint will return real per-user receipts.
 */
export async function GET(req: Request) {
    try {
        const url = new URL(req.url);
        const limit = Math.min(
            Math.max(Number(url.searchParams.get("limit") || "10"), 1),
            25
        );

        // ✅ Current placeholder identity hook:
        // Later, replace with real server auth.
        // For now, allow passing user_id via header (set by future middleware),
        // otherwise return empty to avoid any data exposure.
        const userId =
            req.headers.get("x-imotara-user-id") ||
            url.searchParams.get("user_id") || // optional for internal testing only
            "";

        if (!userId) {
            const res = NextResponse.json(
                {
                    ok: true,
                    items: [],
                    auth: "missing",
                    message:
                        "No user identity available yet. Once auth is enabled, recent donations will appear here.",
                },
                { status: 200 }
            );
            res.headers.set("Cache-Control", "no-store");
            return res;
        }

        const { data, error } = await supabaseServer
            .from("donations")
            .select(
                "id, provider, event_type, razorpay_payment_id, razorpay_order_id, amount_paise, currency, status, is_test, note, created_at"
            )
            .eq("user_id", userId)
            .order("created_at", { ascending: false })
            .limit(limit);

        if (error) {
            const res = NextResponse.json(
                { ok: false, error: error.message },
                { status: 500 }
            );
            res.headers.set("Cache-Control", "no-store");
            return res;
        }

        const res = NextResponse.json(
            {
                ok: true,
                items: data || [],
                auth: "ok",
            },
            { status: 200 }
        );
        res.headers.set("Cache-Control", "no-store");
        return res;
    } catch (e: any) {
        const res = NextResponse.json(
            { ok: false, error: e?.message || "Failed to load donations" },
            { status: 500 }
        );
        res.headers.set("Cache-Control", "no-store");
        return res;
    }
}
