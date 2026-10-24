// POST /api/admin/voice/run — queue the chosen rows, then place what fits now.
//
// ⚠️ Queued rows the lines cannot take yet are placed by the 5-minute cron.
// ⛔ calling_enabled (Settings tab) still decides: off ⇒ rows stay Queued and
// nothing rings.

import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/app/api/admin/_auth";
import { dispatch, queue } from "@/lib/voice/dispatch";
import { sheetsConfigured } from "@/lib/voice/sheets";
import { bolnaConfigured } from "@/lib/voice/bolna";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const auth = await requireSuperAdmin(req);
  if (!auth.ok) return auth.response;
  if (auth.admin.role === "connect_reviewer") return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!sheetsConfigured() || !bolnaConfigured()) {
    return NextResponse.json({ error: "Voice calling is not set up yet (Google or Imotara calling access missing)." }, { status: 409 });
  }

  let body: { rows?: { tab: string; row: number }[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "not JSON" }, { status: 400 });
  }
  const rows = (body.rows ?? []).filter((r) => r && typeof r.tab === "string" && Number.isInteger(r.row)).slice(0, 200);
  if (rows.length === 0) return NextResponse.json({ error: "Choose at least one contact." }, { status: 400 });

  const queued = await queue(rows);
  console.log("[admin/voice/run]", { by: auth.admin.email, queued });
  const r = await dispatch({ auto: false });
  return NextResponse.json({
    queued,
    placedNow: r.placed,
    failed: r.failed,
    note: r.ok ? undefined : r.reason,
  });
}
