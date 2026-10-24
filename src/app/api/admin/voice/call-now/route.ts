// POST /api/admin/voice/call-now — dial chosen contacts now (what fits in a free line), queue the rest.
import { NextRequest, NextResponse } from "next/server";
import { callNow } from "@/lib/voice/dispatch";
import { voiceAdmin, readJson, rowsFrom } from "../_shared";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const a = await voiceAdmin(req);
  if (!a.ok) return a.response;
  const rows = rowsFrom(await readJson<{ rows?: unknown }>(req));
  if (rows.length === 0) return NextResponse.json({ error: "Choose at least one contact." }, { status: 400 });
  const r = await callNow(rows, a.admin.email);
  console.log("[admin/voice/call-now]", { by: a.admin.email, placed: r.placed.length, queued: r.queued.length, skipped: r.skipped.length });
  return NextResponse.json(r, { status: r.ok ? 200 : 409 });
}
