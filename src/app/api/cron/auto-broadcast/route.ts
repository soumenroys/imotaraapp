// GET /api/cron/auto-broadcast — hourly ⇒ vercel.json. Writes the monthly
// newsletter three days ahead and sends the approved drafts on the day
// ⇒ lib/broadcast/autoBroadcast.ts. ⛔ Does nothing while it is switched off.
import { NextRequest, NextResponse } from "next/server";
import { cronAuthorised } from "@/app/api/admin/social/_guard";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { runAutoBroadcast } from "@/lib/broadcast/autoBroadcast";
import { markCronFired } from "@/lib/cron/heartbeat";

export const runtime = "nodejs";
export const maxDuration = 180;

export async function GET(req: NextRequest) {
  const auth = cronAuthorised(req);
  if (!auth.ok) return NextResponse.json({ error: auth.reason }, { status: 401 });
  void markCronFired("/api/cron/auto-broadcast");
  try {
    return NextResponse.json(await runAutoBroadcast(getSupabaseAdmin()));
  } catch (e) {
    console.error("[cron/auto-broadcast]", (e as Error).message);
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
