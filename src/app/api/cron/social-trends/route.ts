// GET /api/cron/social-trends — daily ⇒ vercel.json. Refreshes this week's
// vetted moments (awareness days + filtered trending searches) ⇒ lib/social/trends.ts.
import { NextRequest, NextResponse } from "next/server";
import { cronAuthorised } from "@/app/api/admin/social/_guard";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { refreshTrends } from "@/lib/social/trends";
import { markCronFired } from "@/lib/cron/heartbeat";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function GET(req: NextRequest) {
  const auth = cronAuthorised(req);
  if (!auth.ok) return NextResponse.json({ error: auth.reason }, { status: 401 });
  void markCronFired("/api/cron/social-trends");
  try {
    const s = await refreshTrends(getSupabaseAdmin());
    return NextResponse.json({ ok: true, notes: s.notes.length, kept: s.notes.map((n) => n.topic), rejected: s.rejected.length });
  } catch (e) {
    console.error("[cron/social-trends]", (e as Error).message);
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
