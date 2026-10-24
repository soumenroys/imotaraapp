// GET  /api/admin/broadcast/auto — the monthly newsletter's settings, next date, and past months.
// POST /api/admin/broadcast/auto {enabled?, dayOfMonth?, hourIst?, listIds?}
// Owner only, as broadcast is.
import { NextRequest, NextResponse } from "next/server";
import { requireOwner } from "@/app/api/admin/_auth";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { LEAD_DAYS, nextMonth, readAuto, sendAtFor, themeFor, writeAuto } from "@/lib/broadcast/autoBroadcast";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const auth = await requireOwner(req);
  if (!auth.ok) return auth.response;
  const s = await readAuto(getSupabaseAdmin());
  const now = new Date();
  // 🔑 One rule, shared with the sample: once this month's send time has passed, the next one is next month.
  const month = nextMonth(now, s);
  const sendAt = sendAtFor(month, s.settings);
  return NextResponse.json({
    ...s,
    next: { month, theme: themeFor(month).brief, sendAt: sendAt.toISOString(), draftsAt: new Date(sendAt.getTime() - LEAD_DAYS * 86_400_000).toISOString() },
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireOwner(req);
  if (!auth.ok) return auth.response;
  const b = (await req.json().catch(() => null)) as { enabled?: unknown; dayOfMonth?: unknown; hourIst?: unknown; listIds?: unknown } | null;
  if (!b) return NextResponse.json({ error: "not JSON" }, { status: 400 });
  if (b.dayOfMonth !== undefined && !(Number.isInteger(b.dayOfMonth) && (b.dayOfMonth as number) >= 1 && (b.dayOfMonth as number) <= 28)) {
    return NextResponse.json({ error: "Day of the month must be 1 to 28." }, { status: 400 });
  }
  if (b.hourIst !== undefined && !(Number.isInteger(b.hourIst) && (b.hourIst as number) >= 8 && (b.hourIst as number) <= 20)) {
    return NextResponse.json({ error: "The hour must be between 8 and 20 (India time)." }, { status: 400 });
  }
  const supabase = getSupabaseAdmin();
  const s = await readAuto(supabase);
  if (typeof b.enabled === "boolean") s.settings.enabled = b.enabled;
  if (typeof b.dayOfMonth === "number") s.settings.dayOfMonth = b.dayOfMonth;
  if (typeof b.hourIst === "number") s.settings.hourIst = b.hourIst;
  if (Array.isArray(b.listIds)) s.settings.listIds = b.listIds.filter((x): x is string => typeof x === "string").slice(0, 10);
  if (s.settings.enabled && s.settings.listIds.length === 0) {
    return NextResponse.json({ error: "Choose at least one list before switching it on." }, { status: 400 });
  }
  await writeAuto(supabase, s);
  console.log("[broadcast/auto]", { by: auth.admin.email, ...s.settings });
  return NextResponse.json({ ok: true, settings: s.settings });
}
