// src/app/api/social-proof/route.ts
// EN-5: Social Proof Benchmarking — compares current user's 7-day active days
// against a reference retention distribution.
// Returns a percentile: "more consistent than X% of users."

import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { supabaseUserServer } from "@/lib/supabase/userServer";

function toDateStr(ms: number) {
  return new Date(ms).toISOString().slice(0, 10); // "YYYY-MM-DD"
}

// Empirical percentile table: days active in last 7 → "better than X% of users"
const PERCENTILE_TABLE: Record<number, number> = {
  7: 95,
  6: 88,
  5: 78,
  4: 65,
  3: 50,
  2: 33,
  1: 18,
};

export async function GET() {
  try {
    const userClient = await supabaseUserServer();
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return NextResponse.json({ available: false }, { status: 401 });
    }

    const admin = getSupabaseAdmin();
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

    // Records are stored with id = "{userId}:{recordId}" — filter by id prefix
    const { data: userRows, error } = await admin
      .from("imotara_history")
      .select("created_at_ms")
      .ilike("id", `${user.id}:%`)
      .gte("created_at_ms", sevenDaysAgo)
      .eq("deleted", false);

    if (error) {
      console.error("[social-proof] query error:", error);
      return NextResponse.json({ available: false }, { status: 200 });
    }

    const userActiveDays = new Set(
      (userRows ?? []).map((r: { created_at_ms: number }) => toDateStr(r.created_at_ms))
    ).size;

    if (userActiveDays === 0) {
      return NextResponse.json({ available: false }, { status: 200 });
    }

    const clampedDays = Math.min(userActiveDays, 7);
    const percentileBetter = PERCENTILE_TABLE[clampedDays] ?? 18;

    return NextResponse.json({ available: true, userActiveDays, percentileBetter });
  } catch (err) {
    console.error("[social-proof] error:", err);
    return NextResponse.json({ available: false }, { status: 200 });
  }
}
