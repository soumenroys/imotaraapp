// GET /api/cron/outreach-mail — every 10 minutes ⇒ vercel.json.
//
// 🔑 The unattended outreach mailer: writes missing drafts, sends what is due
// from the Call Directory sheet ⇒ lib/outreach/run.ts.
// ⛔ Does nothing while outreach email is switched off.

import { NextRequest, NextResponse } from "next/server";
import { cronAuthorised } from "@/app/api/admin/social/_guard";
import { sheetsConfigured } from "@/lib/voice/sheets";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { runOutreach } from "@/lib/outreach/run";
import { markCronFired } from "@/lib/cron/heartbeat";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const auth = cronAuthorised(req);
  if (!auth.ok) return NextResponse.json({ error: auth.reason }, { status: 401 });
  // ⚠️ Recorded before anything can fail, so a dead job shows on cron-health.
  void markCronFired("/api/cron/outreach-mail");
  if (!sheetsConfigured()) return NextResponse.json({ ok: true, skipped: "the contact sheet is not connected" });
  try {
    const r = await runOutreach(getSupabaseAdmin());
    return NextResponse.json({ ...r, sent: r.sent.length, sentTo: undefined });
  } catch (e) {
    console.error("[cron/outreach-mail]", (e as Error).message);
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
