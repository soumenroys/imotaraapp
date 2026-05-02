// src/app/api/pulse/route.ts
// NF-5: Anonymous Collective Pulse — aggregate-only, no PII returned.
// Counts today's emotion records across all users to compute heavy-emotion fraction.

import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";

const HEAVY = ["sadness", "anger", "fear"];
const MIN_RECORDS = 10; // suppress below this threshold to avoid misleading %
const CACHE_SECONDS = 300; // re-query every 5 minutes

export async function GET() {
  try {
    const admin = getSupabaseAdmin();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const startMs = todayStart.getTime();

    const { count: totalCount, error: totalErr } = await admin
      .from("imotara_history")
      .select("id", { count: "exact", head: true })
      .gte("created_at_ms", startMs)
      .eq("deleted", false);

    if (totalErr) throw totalErr;

    const total = totalCount ?? 0;

    if (total < MIN_RECORDS) {
      return NextResponse.json(
        { available: false },
        { headers: { "Cache-Control": `public, s-maxage=${CACHE_SECONDS}` } }
      );
    }

    // Count heavy-emotion records using JSONB filter
    let heavyCount = 0;
    for (const emotion of HEAVY) {
      const { count, error } = await admin
        .from("imotara_history")
        .select("id", { count: "exact", head: true })
        .gte("created_at_ms", startMs)
        .eq("deleted", false)
        .filter("record->>emotion", "eq", emotion);

      if (error) throw error;
      heavyCount += count ?? 0;
    }

    const heavyPercent = Math.round((heavyCount / total) * 100);

    return NextResponse.json(
      { available: true, heavyPercent, total },
      { headers: { "Cache-Control": `public, s-maxage=${CACHE_SECONDS}` } }
    );
  } catch (err) {
    console.error("[pulse] error:", err);
    return NextResponse.json({ available: false }, { status: 200 });
  }
}
