// src/app/api/invoice/route.ts
// GET /api/invoice — list current user's invoices

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin, getSupabaseUserServerClient } from "@/lib/supabaseServer";

export async function GET(req: NextRequest) {
  // Resolve user
  let userId: string | null = null;
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (bearer) {
    const { data } = await getSupabaseAdmin().auth.getUser(bearer);
    userId = data?.user?.id ?? null;
  }
  if (!userId) {
    const supabase = await getSupabaseUserServerClient();
    const { data } = await supabase.auth.getUser();
    userId = data?.user?.id ?? null;
  }
  if (!userId) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const { data: invoices, error } = await getSupabaseAdmin()
    .from("payment_invoices")
    .select("id, invoice_number, description, amount_paise, currency, payment_gateway, status, issued_at, tier, period_start, period_end")
    .eq("user_id", userId)
    .order("issued_at", { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ invoices: invoices ?? [] });
}
