// GET /api/cron/social-comments — every 15 minutes ⇒ vercel.json.
//
// 🔑 #51 (owner, 31 Oct + 1 Nov 2026): comments under our Facebook and
// Instagram posts — spam hidden, crisis answered with the crisis line and
// flagged, genuine ones drafted for approval ⇒ lib/social/comments/run.ts.
// ⚠️ GET with a Bearer, like every cron here.

import { NextRequest, NextResponse } from "next/server";
import { cronAuthorised } from "@/app/api/admin/social/_guard";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { markCronFired } from "@/lib/cron/heartbeat";
import { runCommentReplies } from "@/lib/social/comments/run";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function GET(req: NextRequest) {
  const auth = cronAuthorised(req);
  if (!auth.ok) return NextResponse.json({ error: auth.reason }, { status: 401 });
  void markCronFired("/api/cron/social-comments");
  try {
    const r = await runCommentReplies(getSupabaseAdmin());
    if ("errors" in r && r.errors?.length) console.error("[cron/social-comments]", r.errors);
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    console.error("[cron/social-comments]", (e as Error).message);
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
