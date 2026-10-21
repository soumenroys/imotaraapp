// GET /api/cron/voice-dispatch — every 5 minutes ⇒ vercel.json.
//
// 🔑 THE UNATTENDED PATH. Places queued calls as lines free up, catches
// results that never arrived, and — only when the sheet's Settings say
// auto_dispatch — calls due contacts by itself, like social posting.
// ⛔ Does nothing at all while calling_enabled is off, or before the Google
// and Bolna keys exist.

import { NextRequest, NextResponse } from "next/server";
import { cronAuthorised } from "@/app/api/admin/social/_guard";
import { dispatch } from "@/lib/voice/dispatch";
import { sheetsConfigured } from "@/lib/voice/sheets";
import { bolnaConfigured } from "@/lib/voice/bolna";
import { markCronFired } from "@/lib/cron/heartbeat";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function GET(req: NextRequest) {
  const auth = cronAuthorised(req);
  if (!auth.ok) return NextResponse.json({ error: auth.reason }, { status: 401 });
  // ⚠️ Recorded before anything can fail, so a dead job shows on cron-health.
  void markCronFired("/api/cron/voice-dispatch");
  if (!sheetsConfigured() || !bolnaConfigured()) {
    return NextResponse.json({ ok: true, skipped: "voice calling is not set up yet" });
  }
  try {
    const r = await dispatch({ auto: true });
    return NextResponse.json({
      ok: r.ok,
      reason: r.reason,
      placed: r.placed.length,
      failed: r.failed.length,
      reconciled: r.reconciled,
      waiting: r.selection?.skipped.filter((s) => s.reason === "Waiting for a free line").length ?? 0,
    });
  } catch (e) {
    console.error("[cron/voice-dispatch]", (e as Error).message);
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
