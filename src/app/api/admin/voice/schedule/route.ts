// POST /api/admin/voice/schedule {rows, at} — call them at a chosen time.
// DELETE /api/admin/voice/schedule {rows}   — take them off the schedule.
import { NextRequest, NextResponse } from "next/server";
import { schedule, unschedule } from "@/lib/voice/dispatch";
import { voiceAdmin, readJson, rowsFrom } from "../_shared";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const a = await voiceAdmin(req);
  if (!a.ok) return a.response;
  const body = await readJson<{ rows?: unknown; at?: string }>(req);
  const rows = rowsFrom(body);
  const at = new Date(String(body?.at ?? ""));
  if (rows.length === 0) return NextResponse.json({ error: "Choose at least one contact." }, { status: 400 });
  if (!Number.isFinite(at.getTime()) || at.getTime() < Date.now() - 60_000) {
    return NextResponse.json({ error: "Choose a time in the future." }, { status: 400 });
  }
  const n = await schedule(rows, at);
  console.log("[admin/voice/schedule]", { by: a.admin.email, n, at: at.toISOString() });
  return NextResponse.json({ scheduled: n, at: at.toISOString() });
}

export async function DELETE(req: NextRequest) {
  const a = await voiceAdmin(req);
  if (!a.ok) return a.response;
  const rows = rowsFrom(await readJson<{ rows?: unknown }>(req));
  const n = await unschedule(rows);
  console.log("[admin/voice/unschedule]", { by: a.admin.email, n });
  return NextResponse.json({ cancelled: n });
}
