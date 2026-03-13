// src/app/api/donations/recent/route.ts
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { supabaseUserServer } from "@/lib/supabase/userServer";

export async function GET(req: Request) {
    const url = new URL(req.url);
    const limit = Math.min(
        Math.max(Number(url.searchParams.get("limit") || "10"), 1),
        25
    );

    try {
        // Resolve authenticated user via Supabase auth cookies
        let userId: string | null = null;

        try {
            const supabaseUser = await supabaseUserServer();
            const { data } = await supabaseUser.auth.getUser();
            userId = data?.user?.id ?? null;
        } catch {
            // auth unavailable — continue as anonymous
        }

        if (!userId) {
            const res = NextResponse.json(
                {
                    ok: true,
                    items: [],
                    auth: "missing",
                    message: "Sign in to see your donation history.",
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
            { ok: true, items: data || [], auth: "ok" },
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
