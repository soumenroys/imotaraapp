// POST /api/admin/outreach/settings {enabled?, sendWithoutAsking?, dailyCap?}
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { ensureSystemColumns } from "@/lib/voice/sheets";
import { updateOutreach } from "@/lib/outreach/store";
import { outreachAdmin, failed } from "../_shared";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const a = await outreachAdmin(req);
  if (!a.ok) return a.response;
  const b = (await req.json().catch(() => null)) as { enabled?: unknown; sendWithoutAsking?: unknown; dailyCap?: unknown } | null;
  if (!b) return NextResponse.json({ error: "not JSON" }, { status: 400 });
  if (b.dailyCap !== undefined && !(Number.isInteger(b.dailyCap) && (b.dailyCap as number) >= 1 && (b.dailyCap as number) <= 500)) {
    return NextResponse.json({ error: "Emails per day must be a whole number from 1 to 500." }, { status: 400 });
  }
  try {
    // 🔑 Switching on heads the sheet's email columns, so the team sees where to type addresses.
    if (b.enabled === true) await ensureSystemColumns();
    const state = await updateOutreach(getSupabaseAdmin(), (s) => {
      if (typeof b.enabled === "boolean") s.settings.enabled = b.enabled;
      if (typeof b.sendWithoutAsking === "boolean") s.settings.sendWithoutAsking = b.sendWithoutAsking;
      if (typeof b.dailyCap === "number") s.settings.dailyCap = b.dailyCap;
    });
    console.log("[admin/outreach/settings]", { by: a.email, ...state.settings });
    return NextResponse.json({ ok: true, settings: state.settings });
  } catch (e) {
    return failed(e);
  }
}
