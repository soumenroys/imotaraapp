// POST /api/admin/sheet/setup — head, format and lock the Call Directory sheet,
// prove the system can still write to it, and fill the status columns.
//
// 🔑 Owner, 24 Oct 2026: lock everything but the columns an admin fills, and
// make it look professional ⇒ sheets.protectAndFormat. Safe to press again.
import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/app/api/admin/_auth";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { ensureLists, ensureSystemColumns, fillZoneDefaults, protectAndFormat, reorderColumns, sheetsConfigured, updateGuide, verifySystemCanWrite } from "@/lib/voice/sheets";
import { syncProgress } from "@/lib/outreach/syncSheet";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const auth = await requireSuperAdmin(req);
  if (!auth.ok) return auth.response;
  if (auth.admin.role !== "owner") return NextResponse.json({ error: "Only the owner can lock the sheet." }, { status: 403 });
  if (!sheetsConfigured()) return NextResponse.json({ error: "The contact sheet is not connected." }, { status: 409 });
  try {
    await ensureSystemColumns();
    // 🔑 Admin's columns left, system's right (owner, 29 Oct 2026) — whole columns move, data and all.
    const moved = await reorderColumns();
    // 🔑 Owner, 30 Oct 2026: the time zone fills itself when a country is chosen.
    await ensureLists();
    const zones = await fillZoneDefaults();
    await updateGuide();
    const r = await protectAndFormat();
    // 🔴 The lock must not have locked the system out — prove a write still lands.
    await verifySystemCanWrite();
    const status = await syncProgress(getSupabaseAdmin());
    console.log("[admin/sheet/setup]", { by: auth.admin.email, moved, zones, ...r, status });
    return NextResponse.json({ ok: true, moved, zones, ...r, status });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
